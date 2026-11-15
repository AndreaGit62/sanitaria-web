begin;
create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null check (char_length(btrim(original_name)) between 1 and 180),
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg')),
  size bigint not null check (size between 1 and 10485760),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending','ready')),
  appointment_id uuid references public.appointments(id) on delete set null,
  version integer not null default 1 check (version>0),
  created_at timestamptz not null default now(),
  check (storage_path = user_id::text || '/' || id::text || case when mime_type='application/pdf' then '.pdf' else '.jpg' end)
);
-- Se esiste una tabella omonima diversa, fermarsi senza modificare i dati.
do $$
begin
  if exists (
    select 1 from (values
      ('id','uuid'),('user_id','uuid'),('original_name','text'),('mime_type','text'),
      ('size','bigint'),('storage_path','text'),('status','text'),('appointment_id','uuid'),
      ('version','integer'),('created_at','timestamp with time zone')
    ) as expected(column_name,data_type)
    left join information_schema.columns c on c.table_schema='public' and c.table_name='documents'
      and c.column_name=expected.column_name
    where c.column_name is null or c.data_type<>expected.data_type
  ) then
    raise exception 'La tabella documents esistente ha una struttura diversa. Nessun dato modificato: comunicare questo errore prima di proseguire.';
  end if;
  if exists (select 1 from pg_policies where schemaname='public' and tablename='documents'
    and policyname not in ('documents_select_own','documents_insert_own','documents_update_own','documents_delete_own')) then
    raise exception 'La tabella documents contiene policy diverse da quelle previste. Nessun dato modificato: verificare prima di proseguire.';
  end if;
end $$;
create index if not exists documents_user_created on public.documents(user_id,created_at desc);
create index if not exists documents_appointment on public.documents(appointment_id);
alter table public.documents enable row level security;
alter table public.documents force row level security;
revoke all on public.documents from public,anon,authenticated;
grant select,insert,update,delete on public.documents to authenticated;
drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;
drop policy if exists documents_update_own on public.documents;
drop policy if exists documents_delete_own on public.documents;
create policy documents_select_own on public.documents for select to authenticated
  using ((select auth.uid())=user_id);
create policy documents_insert_own on public.documents for insert to authenticated
  with check ((select auth.uid())=user_id and (appointment_id is null or exists
    (select 1 from public.appointments a where a.id=appointment_id and a.user_id=(select auth.uid()))));
create policy documents_update_own on public.documents for update to authenticated
  using ((select auth.uid())=user_id)
  with check ((select auth.uid())=user_id and (appointment_id is null or exists
    (select 1 from public.appointments a where a.id=appointment_id and a.user_id=(select auth.uid()))));
create policy documents_delete_own on public.documents for delete to authenticated
  using ((select auth.uid())=user_id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('medical-documents','medical-documents',false,10485760,array['application/pdf','image/jpeg'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/jpeg'];
drop policy if exists medical_objects_insert_own on storage.objects;
drop policy if exists medical_objects_select_own on storage.objects;
drop policy if exists medical_objects_delete_own on storage.objects;
create policy medical_objects_insert_own on storage.objects for insert to authenticated
  with check (bucket_id='medical-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (select 1 from public.documents d where d.storage_path=name and d.user_id=(select auth.uid()) and d.status='pending'));
create policy medical_objects_select_own on storage.objects for select to authenticated
  using (bucket_id='medical-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (select 1 from public.documents d where d.storage_path=name and d.user_id=(select auth.uid())));
create policy medical_objects_delete_own on storage.objects for delete to authenticated
  using (bucket_id='medical-documents' and (storage.foldername(name))[1]=(select auth.uid())::text
    and exists (select 1 from public.documents d where d.storage_path=name and d.user_id=(select auth.uid())));
-- Nessuna policy UPDATE sugli oggetti: i file sono immutabili, niente sovrascritture.
commit;
