-- Booking reminders have their own date/time, independent of an indicative visit date.
-- Preserve visits, documents, existing subscriptions and scheduler configuration.
begin;
alter table public.appointments drop constraint if exists appointments_check;
alter table public.appointments drop constraint if exists appointments_booking_fields_check;
alter table public.appointments add constraint appointments_booking_fields_check check (
  (booking_status='confirmed' and date is not null and char_length(btrim(hospital))>0)
  or (booking_status='pending' and not done)
);
alter table public.appointments drop constraint if exists appointments_booking_reminder_check;
alter table public.appointments add constraint appointments_booking_reminder_check check (
  reminder is null or booking_status='pending' or reminder < date + coalesce(time,time '00:00')
);
drop index if exists public.appointments_due_push;
create index appointments_due_push on public.appointments(reminder) where reminder is not null and not done;

create or replace function public.claim_visilab_reminders(p_limit integer default 20)
returns table(id uuid) language plpgsql security definer set search_path='' as $$
begin
  update public.push_scheduler_status set last_run_at=now() where push_scheduler_status.id;
  delete from public.push_deliveries where created_at<now()-interval '30 days';
  return query
  insert into public.push_deliveries(appointment_id,subscription_id,reminder_at)
    select a.id,s.id,a.reminder at time zone 'Europe/Rome'
    from public.appointments a join public.push_subscriptions s on s.user_id=a.user_id
    where not a.done and a.reminder is not null
      and (a.reminder at time zone 'Europe/Rome') between now()-interval '15 minutes' and now()
      and (a.reminder at time zone 'Europe/Rome')>=s.created_at
      and (a.booking_status='pending' or ((a.date+coalesce(a.time,time '23:59')) at time zone 'Europe/Rome')>now())
      and not exists(select 1 from public.push_deliveries d where d.appointment_id=a.id and d.subscription_id=s.id and d.reminder_at=(a.reminder at time zone 'Europe/Rome'))
    order by a.reminder,a.id,s.id limit greatest(1,least(p_limit,20))
    on conflict(appointment_id,subscription_id,reminder_at) do nothing
    returning push_deliveries.id;
end $$;
revoke all on function public.claim_visilab_reminders(integer) from public,anon,authenticated;
grant execute on function public.claim_visilab_reminders(integer) to service_role;

create or replace function public.prepare_visilab_reminder(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.push_deliveries; a public.appointments; s public.push_subscriptions;
begin
  select * into d from public.push_deliveries where id=p_id and state='claimed' for update skip locked;
  if not found then return null; end if;
  select * into a from public.appointments where id=d.appointment_id;
  select * into s from public.push_subscriptions where id=d.subscription_id;
  if a.id is null or s.id is null or a.user_id<>s.user_id or a.done or
    a.reminder is null or (a.reminder at time zone 'Europe/Rome')<>d.reminder_at or
    (a.booking_status='confirmed' and ((a.date+coalesce(a.time,time '23:59')) at time zone 'Europe/Rome')<=now()) or
    d.reminder_at<now()-interval '15 minutes'
  then
    update public.push_deliveries set state='cancelled',finished_at=now() where id=p_id;
    return null;
  end if;
  update public.push_deliveries set state='sending' where id=p_id;
  return jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
    'vapidPublicKey',s.vapid_public_key,'subscriptionId',s.id,'appointmentId',a.id,'reminderAt',d.reminder_at,'bookingStatus',a.booking_status);
end $$;
revoke all on function public.prepare_visilab_reminder(uuid) from public,anon,authenticated;
grant execute on function public.prepare_visilab_reminder(uuid) to service_role;
commit;
