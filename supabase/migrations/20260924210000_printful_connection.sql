-- Server-only switch allows product mappings and the fulfillment account to change together.
create table public.fulfillment_connection (
 id boolean primary key default true check(id),
 store_id text not null,
 paused boolean not null default false
);
alter table public.fulfillment_connection enable row level security;
revoke all on public.fulfillment_connection from anon,authenticated;
grant all on public.fulfillment_connection to service_role;
insert into public.fulfillment_connection(id,store_id) values(true,'17933770');
alter table public.orders add column printful_store_id text;
update public.orders set printful_store_id='17933770' where printful_store_id is null;

create function public.switch_printful_connection(p_old text,p_new text,p_products jsonb,p_jobs jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare r jsonb;
begin
 perform 1 from public.fulfillment_connection where id=true and paused and store_id=p_old for update;
 if not found then raise exception 'Pause the expected source connection first'; end if;
 lock table public.products,public.product_generation_jobs in share row exclusive mode;
 if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then raise exception 'Worker still running'; end if;
 if (select count(*) from public.products)<>jsonb_array_length(p_products) or (select count(*) from public.product_generation_jobs)<>jsonb_array_length(p_jobs) then raise exception 'Inventory changed'; end if;
 for r in select * from jsonb_array_elements(p_products) loop
   update public.products set variants=r->'variants',printful_sync_product_id=(r->>'sync_id')::bigint
     where id=(r->>'id')::uuid and updated_at=(r->>'updated_at')::timestamptz;
   if not found then raise exception 'Product changed: %',r->>'id'; end if;
 end loop;
 for r in select * from jsonb_array_elements(p_jobs) loop
   update public.product_generation_jobs set state=r->'state',review_mockup=r->'review_mockup',lease_until=null,lease_token=null,
     status=case when status='running' then 'pending' else status end
     where id=(r->>'id')::uuid and updated_at=(r->>'updated_at')::timestamptz;
   if not found then raise exception 'Job changed: %',r->>'id'; end if;
 end loop;
 update public.fulfillment_connection set store_id=p_new where id=true;
end; $$;
revoke all on function public.switch_printful_connection(text,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.switch_printful_connection(text,text,jsonb,jsonb) to service_role;
