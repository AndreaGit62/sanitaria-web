-- Keep existing iPhone authorizations; remove previous desktop/Android subscriptions only.
-- Appointments, documents, profiles and the scheduler are unchanged.
begin;
delete from public.push_subscriptions where endpoint !~ '^https://web\.push\.apple\.com/';
create or replace function public.register_visilab_push(p_endpoint text,p_p256dh text,p_auth text,p_vapid text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Accesso richiesto'; end if;
  if p_endpoint is null or char_length(p_endpoint)>2048 or
    p_endpoint !~ '^https://web\.push\.apple\.com/' or
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

commit;
