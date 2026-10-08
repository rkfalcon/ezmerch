alter table public.stores add column show_on_homepage boolean not null default true;

create function private.protect_store_homepage_visibility() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (tg_op = 'INSERT' and not new.show_on_homepage) or
     (tg_op = 'UPDATE' and new.show_on_homepage is distinct from old.show_on_homepage) then
    if coalesce(auth.role(), '') in ('anon', 'authenticated') and not private.lineup_admin() then
      raise exception 'Only admins can change homepage visibility';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.protect_store_homepage_visibility() from public, anon, authenticated;
create trigger protect_store_homepage_visibility before insert or update on public.stores
for each row execute function private.protect_store_homepage_visibility();
