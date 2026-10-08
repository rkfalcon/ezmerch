-- Keep the existing admin claimant display populated for every ownership path.
create function public.populate_store_owner_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.claimed and new.owner_id is not null then
    select email into new.owner_email from auth.users where id = new.owner_id;
  else
    new.owner_email := null;
  end if;
  return new;
end;
$$;
revoke all on function public.populate_store_owner_email() from public, anon, authenticated;
create trigger populate_store_owner_email
before insert or update of owner_id, claimed, owner_email on public.stores
for each row execute function public.populate_store_owner_email();

-- Repair historical claims without changing ownership or claim timestamps.
update public.stores s
set owner_email = u.email
from auth.users u
where s.owner_id = u.id and s.claimed
  and s.owner_email is distinct from u.email;
