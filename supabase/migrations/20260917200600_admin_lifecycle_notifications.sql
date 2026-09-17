-- Admin-only alerts for signup, store creation, and store claim.
-- Reuses notifications + notification_emails so Resend still goes through deliverLineupEmails.

create function private.notify_admins(p_title text, p_message text, p_href text, p_event_key text, p_store_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare r record; n uuid;
begin
  for r in select distinct user_id as id from public.user_roles where role='admin' loop
    n := null;
    insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
      values(r.id,p_store_id,p_title,p_message,p_href,p_event_key)
      on conflict(recipient_id,event_key) where event_key is not null do nothing
      returning id into n;
    if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
  end loop;
end; $$;
revoke all on function private.notify_admins(text,text,text,text,uuid) from public,anon,authenticated;

create function private.user_notify_label(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
  select case
    when nullif(u.raw_user_meta_data->>'display_name','') is not null and nullif(to_jsonb(u)->>'email','') is not null
      then (u.raw_user_meta_data->>'display_name')||' ('||(to_jsonb(u)->>'email')||')'
    when nullif(to_jsonb(u)->>'email','') is not null then to_jsonb(u)->>'email'
    when nullif(u.raw_user_meta_data->>'display_name','') is not null then u.raw_user_meta_data->>'display_name'
    else p_user::text
  end
  from auth.users u where u.id=p_user;
$$;
revoke all on function private.user_notify_label(uuid) from public,anon,authenticated;

create function private.notify_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare label text; email text; name text;
begin
  email := nullif(to_jsonb(new)->>'email','');
  name := nullif(new.raw_user_meta_data->>'display_name','');
  if name is not null and email is not null then label := name||' ('||email||')';
  elsif email is not null then label := email;
  elsif name is not null then label := name;
  else label := new.id::text;
  end if;
  perform private.notify_admins(
    'New account signup',
    label||' created an account.',
    '/dashboard/admin',
    'signup:'||new.id,
    null
  );
  return new;
end; $$;
revoke all on function private.notify_new_user() from public,anon,authenticated;
create trigger on_auth_user_created_notify after insert on auth.users
  for each row execute function private.notify_new_user();

create function private.notify_store_created() returns trigger language plpgsql security definer set search_path='' as $$
declare msg text;
begin
  msg := new.name||' (/'||new.slug||') was created';
  if new.owner_id is not null then
    msg := msg||' by '||coalesce(private.user_notify_label(new.owner_id), new.owner_id::text);
  end if;
  if not new.claimed then msg := msg||' and is waiting to be claimed'; end if;
  perform private.notify_admins(
    'New store created',
    msg||'.',
    '/dashboard/admin/stores/'||new.id,
    'store-created:'||new.id,
    new.id
  );
  return new;
end; $$;
revoke all on function private.notify_store_created() from public,anon,authenticated;
create trigger store_created_admin_notify after insert on public.stores
  for each row execute function private.notify_store_created();

create function private.notify_store_claimed() returns trigger language plpgsql security definer set search_path='' as $$
declare msg text;
begin
  if new.claimed is not true or old.claimed is not distinct from true then return new; end if;
  msg := new.name||' (/'||new.slug||') was claimed';
  if new.owner_id is not null then
    msg := msg||' by '||coalesce(private.user_notify_label(new.owner_id), new.owner_id::text);
  end if;
  perform private.notify_admins(
    'Store claimed',
    msg||'.',
    '/dashboard/admin/stores/'||new.id,
    'store-claimed:'||new.id,
    new.id
  );
  return new;
end; $$;
revoke all on function private.notify_store_claimed() from public,anon,authenticated;
create trigger store_claimed_admin_notify after update of claimed on public.stores
  for each row execute function private.notify_store_claimed();
