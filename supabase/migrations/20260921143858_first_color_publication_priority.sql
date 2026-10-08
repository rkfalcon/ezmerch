create or replace function public.claim_lineup_job() returns setof public.product_generation_jobs language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(918273);
  if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then return; end if;
  return query update public.product_generation_jobs j set status='running',lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now()
    where j.id=(select q.id from public.product_generation_jobs q join public.product_templates t on t.id=q.template_id
      where t.active and not coalesce((t.supplier_stock->>'discontinued')::boolean,false) and q.status in ('pending','running') and q.available_at<=now() and (q.lease_until is null or q.lease_until<now())
      -- Finish one purchasable color for each product before remaining colors.
      order by coalesce((q.state->>'publishedVariantCount')::integer,0)>0,
        exists(select 1 from jsonb_array_elements(coalesce(q.state->'batches','[]')) b where jsonb_array_length(coalesce(b->'images','[]'))>0 or jsonb_array_length(coalesce(b->'downloadedImages','[]'))>0) desc,
        q.available_at,q.created_at limit 1 for update of q skip locked) returning j.*;
end; $$;

