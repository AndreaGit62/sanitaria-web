begin;
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  specialty text not null check (specialty in ('Cardiologia','Laboratorio','Oculistica','Dermatologia','Altra visita')),
  hospital text not null check (char_length(btrim(hospital)) between 1 and 150),
  date date not null check (date between '1900-01-01' and '2100-12-31'),
  time time without time zone not null check (extract(second from time) = 0),
  doctor text not null default '' check (char_length(doctor) <= 150),
  notes text not null default '' check (char_length(notes) <= 2000),
  reminder timestamp without time zone check (reminder is null or (reminder >= '1900-01-01' and reminder <= '2100-12-31 23:59:00' and extract(second from reminder) = 0)),
  done boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  check (reminder is null or reminder < date + time)
);
comment on table public.appointments is 'Visite private. Date e orari sono riferiti a Europe/Rome. Nessun invio automatico dei promemoria.';
create index appointments_user_date on public.appointments(user_id,date);
alter table public.appointments enable row level security;
alter table public.appointments force row level security;
revoke all on public.appointments from public, anon, authenticated;
grant select, insert, update, delete on public.appointments to authenticated;
create policy appointments_select_own on public.appointments for select to authenticated
  using ((select auth.uid()) = user_id);
create policy appointments_insert_own on public.appointments for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy appointments_update_own on public.appointments for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy appointments_delete_own on public.appointments for delete to authenticated
  using ((select auth.uid()) = user_id);
commit;
