alter table public.stores
  add column website_url text,
  add column onboarding_started_at timestamptz,
  add column selling_enabled boolean not null default true;

-- Self-serve creation is atomic and idempotent. Only the trusted server can call it.
create function public.create_onboarding_store(p_owner uuid, p_name text, p_website text, p_slug text)
returns uuid language plpgsql security definer set search_path='' as $$
declare store_id uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_owner::text,0));
  if not exists(select 1 from auth.users where id=p_owner and email_confirmed_at is not null) then
    raise exception 'Confirm your email before creating a store';
  end if;
  select id into store_id from public.stores where owner_id=p_owner order by created_at limit 1;
  if store_id is not null then return store_id; end if;
  if char_length(trim(p_name)) not between 1 and 100 then raise exception 'Invalid store name'; end if;
  insert into public.stores(name,slug,owner_id,claimed,claimed_at,website_url,onboarding_started_at,selling_enabled)
    values(trim(p_name),p_slug,p_owner,true,now(),p_website,now(),false) returning id into store_id;
  insert into public.user_roles(user_id,role,store_id) values(p_owner,'store_owner',store_id) on conflict do nothing;
  return store_id;
end; $$;
revoke all on function public.create_onboarding_store(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.create_onboarding_store(uuid,text,text,text) to service_role;

create function private.protect_store_launch() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.role() in ('authenticated','anon') and (
    new.selling_enabled is distinct from old.selling_enabled or
    new.onboarding_started_at is distinct from old.onboarding_started_at or
    new.stripe_account_id is distinct from old.stripe_account_id
  ) then raise exception 'Use the secure store setup flow'; end if;
  return new;
end; $$;
revoke all on function private.protect_store_launch() from public,anon,authenticated;
create trigger protect_store_launch before update on public.stores for each row execute function private.protect_store_launch();
