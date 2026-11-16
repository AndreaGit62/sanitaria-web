begin;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh)=87),
  auth text not null check (char_length(auth)=22),
  vapid_public_key text not null check (char_length(vapid_public_key)=87),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  test_sent_at timestamptz
);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on public.push_subscriptions from public, anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
drop policy if exists push_select_own on public.push_subscriptions;
create policy push_select_own on public.push_subscriptions for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists push_delete_own on public.push_subscriptions;
create policy push_delete_own on public.push_subscriptions for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists push_subscriptions_owner on public.push_subscriptions(user_id);

create table if not exists public.push_scheduler_status (
  id boolean primary key default true check (id),
  last_run_at timestamptz
);
insert into public.push_scheduler_status(id) values(true) on conflict do nothing;
alter table public.push_scheduler_status enable row level security;
alter table public.push_scheduler_status force row level security;
revoke all on public.push_scheduler_status from public, anon, authenticated;
grant select on public.push_scheduler_status to authenticated;
grant all on public.push_scheduler_status to service_role;
drop policy if exists push_status_read on public.push_scheduler_status;
create policy push_status_read on public.push_scheduler_status for select to authenticated using (true);

create table if not exists public.push_deliveries (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_at timestamptz not null,
  state text not null default 'claimed' check(state in ('claimed','sending','sent','failed','cancelled')),
  provider_status integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(appointment_id,subscription_id,reminder_at)
);
alter table public.push_deliveries enable row level security;
alter table public.push_deliveries force row level security;
revoke all on public.push_deliveries from public, anon, authenticated;
grant all on public.push_deliveries to service_role;
create index if not exists appointments_due_push on public.appointments(reminder) where reminder is not null and not done and booking_status='confirmed';

create or replace function public.register_visilab_push(p_endpoint text,p_p256dh text,p_auth text,p_vapid text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Accesso richiesto'; end if;
  if p_endpoint is null or char_length(p_endpoint)>2048 or
    p_endpoint !~ '^https://(web\.push\.apple\.com|fcm\.googleapis\.com|([a-z0-9-]+\.)*push\.services\.mozilla\.com|([a-z0-9-]+\.)+notify\.windows\.com)/' or
    p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{87}$' or
    p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22}$' or
    p_vapid is null or p_vapid !~ '^[A-Za-z0-9_-]{87}$'
  then raise exception 'Dispositivo non valido'; end if;
  -- Serialize registrations per account so simultaneous requests cannot exceed the limit.
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  if (select count(*) from public.push_subscriptions where user_id=uid)>=10 and
    not exists(select 1 from public.push_subscriptions where user_id=uid and endpoint=p_endpoint)
  then raise exception 'Massimo 10 dispositivi'; end if;
  insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,vapid_public_key)
    values(uid,p_endpoint,p_p256dh,p_auth,p_vapid)
    on conflict(endpoint) do update set p256dh=excluded.p256dh,auth=excluded.auth,
      vapid_public_key=excluded.vapid_public_key,last_seen_at=now()
      where push_subscriptions.user_id=uid
    returning id into result;
  if result is null then raise exception 'Dispositivo da riattivare'; end if;
  return result;
end $$;
revoke all on function public.register_visilab_push(text,text,text,text) from public,anon;
grant execute on function public.register_visilab_push(text,text,text,text) to authenticated;

create or replace function public.claim_visilab_push_test(p_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.push_subscriptions;
begin
  update public.push_subscriptions set test_sent_at=now()
    where id=p_id and user_id=auth.uid() and (test_sent_at is null or test_sent_at<now()-interval '60 seconds')
    returning * into s;
  if not found then return null; end if;
  return jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),'vapidPublicKey',s.vapid_public_key);
end $$;
revoke all on function public.claim_visilab_push_test(uuid) from public,anon;
grant execute on function public.claim_visilab_push_test(uuid) to authenticated;

create or replace function public.claim_visilab_reminders(p_limit integer default 20)
returns table(id uuid) language plpgsql security definer set search_path='' as $$
begin
  update public.push_scheduler_status set last_run_at=now() where push_scheduler_status.id;
  delete from public.push_deliveries where created_at<now()-interval '30 days';
  -- Window of recovery for a short scheduler outage. Never send after the visit.
  return query
  insert into public.push_deliveries(appointment_id,subscription_id,reminder_at)
    select a.id,s.id,a.reminder at time zone 'Europe/Rome'
    from public.appointments a join public.push_subscriptions s on s.user_id=a.user_id
    where a.booking_status='confirmed' and not a.done and a.reminder is not null
      and (a.reminder at time zone 'Europe/Rome') between now()-interval '15 minutes' and now()
      and (a.reminder at time zone 'Europe/Rome')>=s.created_at
      and ((a.date+coalesce(a.time,time '23:59')) at time zone 'Europe/Rome')>now()
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
  if a.id is null or s.id is null or a.user_id<>s.user_id or a.done or a.booking_status<>'confirmed' or
    a.reminder is null or (a.reminder at time zone 'Europe/Rome')<>d.reminder_at or
    ((a.date+coalesce(a.time,time '23:59')) at time zone 'Europe/Rome')<=now() or
    d.reminder_at<now()-interval '15 minutes'
  then
    update public.push_deliveries set state='cancelled',finished_at=now() where id=p_id;
    return null;
  end if;
  update public.push_deliveries set state='sending' where id=p_id;
  return jsonb_build_object('endpoint',s.endpoint,'keys',jsonb_build_object('p256dh',s.p256dh,'auth',s.auth),
    'vapidPublicKey',s.vapid_public_key,'subscriptionId',s.id,'appointmentId',a.id,'reminderAt',d.reminder_at);
end $$;
revoke all on function public.prepare_visilab_reminder(uuid) from public,anon,authenticated;
grant execute on function public.prepare_visilab_reminder(uuid) to service_role;

comment on table public.push_deliveries is 'A single send attempt per device and reminder; ambiguous network failures are not retried to avoid repeated alerts. Sent means accepted by provider, not displayed by phone.';
commit;
