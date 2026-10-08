-- Lightweight queue scheduling: do not transfer large generation state to decide when to wake.
create or replace function public.next_lineup_wakeup() returns timestamptz
language sql stable security invoker set search_path='' as $$
  select coalesce(
    (select max(lease_until) from public.product_generation_jobs where status='running' and lease_until>now()),
    min(greatest(j.available_at, coalesce(j.lease_until, j.available_at))))
  from public.product_generation_jobs j join public.product_templates t on t.id=j.template_id
  where j.status in ('pending','running') and t.active
    and not coalesce((t.supplier_stock->>'discontinued')::boolean,false);
$$;
revoke all on function public.next_lineup_wakeup() from public,anon,authenticated;
grant execute on function public.next_lineup_wakeup() to service_role;
