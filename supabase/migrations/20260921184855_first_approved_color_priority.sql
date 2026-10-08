-- Snapshot technique matches the worker's effective template. Failed/stock-held jobs
-- do not hold up the queue; short supplier waits retain first-publication priority.
create or replace function public.lineup_work_priority(state jsonb, technique text)
returns integer language sql immutable security invoker set search_path='' as $$
  select case
    when coalesce((state->>'publishedVariantCount')::integer,0)>0 then 2
    when technique='embroidery'
      and coalesce(state->'printQuality'->>'status','')<>'ready'
      and coalesce(state->'printQuality'->>'reviewedAt','')='' then 1
    else 0 end;
$$;
revoke all on function public.lineup_work_priority(jsonb,text) from public,anon,authenticated;
grant execute on function public.lineup_work_priority(jsonb,text) to service_role;

create or replace function public.claim_lineup_job() returns setof public.product_generation_jobs
language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(918273);
  if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then return; end if;
  return query
  with candidates as materialized (
    select q.id,q.available_at,q.created_at,q.state,
      public.lineup_work_priority(q.state,coalesce(q.template_snapshot->>'technique',t.technique)) priority
    from public.product_generation_jobs q join public.product_templates t on t.id=q.template_id
    where t.active and not coalesce((t.supplier_stock->>'discontinued')::boolean,false)
      and q.status in ('pending','running')
      and q.available_at<=now()+interval '5 minutes'
      and (q.lease_until is null or q.lease_until<now())
  )
  update public.product_generation_jobs j
  set status='running',lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now()
  where j.id=(
    select q.id from public.product_generation_jobs q join candidates c on c.id=q.id
    where c.priority=(select min(priority) from candidates) and c.available_at<=now()
    order by
      exists(select 1 from jsonb_array_elements(coalesce(c.state->'batches','[]')) b
        where jsonb_array_length(coalesce(b->'images','[]'))>0
           or jsonb_array_length(coalesce(b->'downloadedImages','[]'))>0) desc,
      c.available_at,c.created_at
    limit 1 for update of q skip locked
  ) returning j.*;
end; $$;

create or replace function public.next_lineup_wakeup() returns timestamptz
language sql stable security invoker set search_path='' as $$
  with candidates as (
    select greatest(j.available_at,coalesce(j.lease_until,j.available_at)) available_at,
      public.lineup_work_priority(j.state,coalesce(j.template_snapshot->>'technique',t.technique)) priority
    from public.product_generation_jobs j join public.product_templates t on t.id=j.template_id
    where j.status in ('pending','running') and t.active
      and not coalesce((t.supplier_stock->>'discontinued')::boolean,false)
  ), urgent as (
    select min(priority) priority from candidates where available_at<=now()+interval '5 minutes'
  )
  select coalesce(
    (select max(lease_until) from public.product_generation_jobs where status='running' and lease_until>now()),
    (select min(available_at) from candidates where priority=(select priority from urgent)),
    (select min(available_at) from candidates));
$$;
