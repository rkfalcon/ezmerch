-- Durable admin-only alerts, inserted atomically with a failed generation.
create function private.notify_artwork_failure() returns trigger
language plpgsql security definer set search_path='' as $$
declare store_name text;
begin
  if new.status <> 'failed' then return new; end if;
  select name into store_name from public.stores where id=new.store_id;
  perform private.notify_admins(
    'Artwork needs EzMerch attention: '||coalesce(store_name,'Store'),
    coalesce(new.template_snapshot->>'title','Product')||': '||coalesce(new.last_error,'Generation could not finish.')||
    ' The store owner is not being asked to fix this. Review the artwork and print dimensions in the admin store dashboard; approve a reviewable design or replace the artwork/update its template and regenerate.',
    '/dashboard/admin/stores/'||new.store_id,
    'artwork-attention:'||coalesce(new.generation_id,new.id)::text,
    new.store_id
  );
  return new;
end; $$;
revoke all on function private.notify_artwork_failure() from public,anon,authenticated;
create trigger artwork_failure_admin_notify after insert or update of status on public.product_generation_jobs
for each row execute function private.notify_artwork_failure();
-- Surface existing holds without changing their approval or restarting supplier work.
update public.product_generation_jobs set status=status where status='failed';
