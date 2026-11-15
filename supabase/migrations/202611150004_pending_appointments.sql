begin;
alter table public.appointments add column if not exists booking_status text not null default 'confirmed';
alter table public.appointments alter column date drop not null;
alter table public.appointments alter column time drop not null;
alter table public.appointments drop constraint if exists appointments_hospital_check;
alter table public.appointments drop constraint if exists appointments_booking_status_check;
alter table public.appointments drop constraint if exists appointments_booking_fields_check;
alter table public.appointments drop constraint if exists appointments_booking_reminder_check;
alter table public.appointments add constraint appointments_hospital_check check (char_length(hospital)<=150);
alter table public.appointments add constraint appointments_booking_status_check check (booking_status in ('pending','confirmed'));
alter table public.appointments add constraint appointments_booking_fields_check check (
  (booking_status='confirmed' and date is not null and char_length(btrim(hospital))>0)
  or (booking_status='pending' and not done and reminder is null)
);
alter table public.appointments add constraint appointments_booking_reminder_check check (
  reminder is null or (booking_status='confirmed' and reminder < date + coalesce(time,time '00:00'))
);
create index if not exists appointments_user_booking on public.appointments(user_id,booking_status);
comment on column public.appointments.booking_status is 'pending: visita da prenotare; confirmed: data e struttura definite. Gli orari sono riferiti a Europe/Rome.';
commit;
