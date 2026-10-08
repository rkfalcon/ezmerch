create or replace function public.claim_product_gallery_job() returns setof public.product_gallery_jobs
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(918274);
 insert into public.product_gallery_jobs(source_job,product_id,generation_id,source_revision)
 select j.id,p.id,coalesce(j.generation_id,j.id),md5(j.state::text)
 from public.product_generation_jobs j join public.products p on p.store_id=j.store_id and p.template_id=j.template_id
 where j.status='completed' and p.global_active
 on conflict(source_job) do update set generation_id=excluded.generation_id,source_revision=excluded.source_revision,
 state='{}',status='pending',attempts=0,last_error=null,available_at=now(),lease_token=null,lease_until=null
 where product_gallery_jobs.generation_id<>excluded.generation_id or product_gallery_jobs.source_revision<>excluded.source_revision;
 if exists(select 1 from public.product_gallery_jobs where status='running' and lease_until>now()) then return; end if;
 return query update public.product_gallery_jobs g set status='running',lease_token=gen_random_uuid(),lease_until=now()+interval '3 minutes',updated_at=now()
 where g.id=(select q.id from public.product_gallery_jobs q join public.products p on p.id=q.product_id
 join public.product_generation_jobs j on j.id=q.source_job
 where q.status in ('pending','running') and q.available_at<=now() and (q.lease_until is null or q.lease_until<now())
 and p.global_active and j.status='completed' and md5(j.state::text)=q.source_revision
 order by q.available_at,q.id limit 1 for update of q skip locked) returning g.*;
end; $$;
revoke all on function public.claim_product_gallery_job() from public,anon,authenticated;
grant execute on function public.claim_product_gallery_job() to service_role;


-- Retry previously skipped long sleeves; leave Comfort Colors as requested.
update public.product_gallery_jobs g set state='{}',status='pending',attempts=0,last_error=null,available_at=now(),lease_token=null,lease_until=null
from public.product_generation_jobs j where j.id=g.source_job and g.state->>'unavailable'='true' and j.template_snapshot->>'category'='Long Sleeve Shirts';
