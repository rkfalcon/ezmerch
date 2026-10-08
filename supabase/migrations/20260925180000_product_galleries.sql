-- Extra model views are independent of sale readiness and never change publication.
alter table public.products add column gallery_images jsonb not null default '[]';
create table public.product_gallery_jobs (
 id uuid primary key default gen_random_uuid(),
 source_job uuid not null unique references public.product_generation_jobs(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete cascade,
 generation_id uuid not null,
 source_revision text not null,
 status text not null default 'pending' check(status in ('pending','running','completed','failed')),
 state jsonb not null default '{}',
 attempts integer not null default 0,
 last_error text,
 available_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 updated_at timestamptz not null default now()
);
alter table public.product_gallery_jobs enable row level security;
revoke all on public.product_gallery_jobs from anon,authenticated;
grant all on public.product_gallery_jobs to service_role;

create function private.clear_product_gallery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.generation_id is distinct from old.generation_id or (old.status='completed' and new.status<>'completed') then
  update public.products set gallery_images='[]' where store_id=new.store_id and template_id=new.template_id;
  delete from public.product_gallery_jobs where source_job=new.id;
 end if;
 return new;
end; $$;
revoke all on function private.clear_product_gallery() from public,anon,authenticated;
create trigger clear_product_gallery after update of generation_id,status on public.product_generation_jobs
 for each row execute function private.clear_product_gallery();

create function public.claim_product_gallery_job() returns setof public.product_gallery_jobs
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(918274);
 insert into public.product_gallery_jobs(source_job,product_id,generation_id,source_revision)
 select j.id,p.id,coalesce(j.generation_id,j.id),md5(j.state::text)
 from public.product_generation_jobs j join public.products p on p.store_id=j.store_id and p.template_id=j.template_id
 where j.status='completed' and p.global_active
 and j.template_snapshot->>'category' in ('T-Shirts','Long Sleeve Shirts','Hoodies & Sweatshirts','Polo Shirts')
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

create function public.save_product_gallery_job(p_job uuid,p_lease uuid,p_state jsonb,p_images jsonb,p_complete boolean,p_delay_ms integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare g public.product_gallery_jobs; j public.product_generation_jobs;
begin
 -- Lock the source first, the same order as logo replacement's invalidation trigger.
 select s.* into j from public.product_generation_jobs s join public.product_gallery_jobs q on q.source_job=s.id where q.id=p_job for update of s;
 select * into g from public.product_gallery_jobs where id=p_job and lease_token=p_lease and lease_until>now() for update;
 if g.id is null or j.status<>'completed' or coalesce(j.generation_id,j.id)<>g.generation_id or md5(j.state::text)<>g.source_revision then return false; end if;
 if p_images is not null then update public.products set gallery_images=p_images where id=g.product_id; end if;
 update public.product_gallery_jobs set state=p_state,status=case when p_complete then 'completed' else 'pending' end,
 available_at=now()+greatest(0,p_delay_ms)*interval '1 millisecond',lease_token=null,lease_until=null,last_error=null,attempts=0,updated_at=now() where id=g.id;
 return true;
end; $$;
revoke all on function public.save_product_gallery_job(uuid,uuid,jsonb,jsonb,boolean,integer) from public,anon,authenticated;
grant execute on function public.save_product_gallery_job(uuid,uuid,jsonb,jsonb,boolean,integer) to service_role;
