-- A generation revision isolates replaced artwork from in-flight workers and old orders.
alter table public.product_generation_jobs add column generation_id uuid;
alter table public.product_generation_jobs alter column generation_id set default gen_random_uuid();
alter table public.order_items add column printful_sync_variant_id bigint;
-- Preserve the fulfillment design before any product is regenerated.
update public.order_items i set printful_sync_variant_id=(v->>'sync_variant_id')::bigint
from public.products p cross join lateral jsonb_array_elements(p.variants) v
where i.product_id=p.id and v->>'variant_id'=i.variant_key and v->>'sync_variant_id' is not null;

create or replace function private.store_logo_lineup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.lineup_logo_path is null then return new; end if;
  if tg_op='UPDATE' and old.lineup_logo_path is distinct from new.lineup_logo_path and old.lineup_logo_path is not null then
    -- Reset in one transaction; revoked leases cannot overwrite the new generation.
    update public.product_generation_jobs set logo_path=new.lineup_logo_path,generation_id=gen_random_uuid(),
      state='{}',status='pending',attempts=0,last_error=null,available_at=now(),lease_token=null,lease_until=null,updated_at=now()
      where store_id=new.id;
    insert into public.product_generation_jobs(store_id,template_id,template_snapshot,logo_path,publish_on_complete)
      select new.id,t.id,to_jsonb(t),new.lineup_logo_path,p.published from public.products p
      join public.product_templates t on t.id=p.template_id where p.store_id=new.id
      on conflict(store_id,template_id) do nothing;
  end if;
  perform private.enqueue_store_lineup(new.id);
  return new;
end; $$;

create or replace function public.claim_lineup_job() returns setof public.product_generation_jobs language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(918273);
  if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then return; end if;
  return query update public.product_generation_jobs j set status='running',lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now()
    where j.id=(select q.id from public.product_generation_jobs q join public.product_templates t on t.id=q.template_id
      where t.active and q.status in ('pending','running') and q.available_at<=now() and (q.lease_until is null or q.lease_until<now())
      -- Every product without a preview goes ahead of the remaining color batches.
      order by exists(select 1 from jsonb_array_elements(coalesce(q.state->'batches','[]')) b where jsonb_array_length(coalesce(b->'images','[]'))>0 or jsonb_array_length(coalesce(b->'downloadedImages','[]'))>0),
        q.available_at,q.created_at limit 1 for update of q skip locked) returning j.*;
end; $$;

create or replace function public.complete_lineup_job(p_job uuid,p_lease uuid,p_sync_id bigint,p_variants jsonb,p_images jsonb) returns uuid language plpgsql set search_path='' as $$
declare j public.product_generation_jobs; s public.stores; product uuid; r record; n uuid; existing_product public.products;
begin
  select * into j from public.product_generation_jobs where id=p_job and lease_token=p_lease and status='running' and lease_until>now() for update;
  if j.id is null then raise exception 'Generation lease expired'; end if;
  if jsonb_array_length(p_variants)=0 or jsonb_array_length(p_images)=0 then raise exception 'Products need variants and branded images'; end if;
  select * into s from public.stores where id=j.store_id;
  select * into existing_product from public.products where store_id=j.store_id and template_id=j.template_id for update;
  if existing_product.id is not null then
    -- Keep the owner's prices and all visibility/default-color choices.
    select jsonb_agg(v || jsonb_build_object('retail_price',coalesce(
      (select old_v->'retail_price' from jsonb_array_elements(existing_product.variants) old_v where old_v->>'variant_id'=v->>'variant_id' limit 1),v->'retail_price')))
      into p_variants from jsonb_array_elements(p_variants) v;
    update public.products set printful_sync_product_id=p_sync_id,variants=p_variants,
      thumbnail_url=p_images->0->>'url',mockup_images=p_images,updated_at=now() where id=existing_product.id;
    update public.product_generation_jobs set status='completed',lease_until=null,lease_token=null,last_error=null,updated_at=now() where id=j.id;
    return existing_product.id;
  end if;
  insert into public.products(store_id,template_id,title,description,printful_sync_product_id,variants,thumbnail_url,mockup_images,published)
    values(j.store_id,j.template_id,j.template_snapshot->>'title',j.template_snapshot->>'description',p_sync_id,p_variants,p_images->0->>'url',p_images,j.publish_on_complete)
    on conflict(store_id,template_id) where template_id is not null do nothing returning id into product;
  if product is not null and not j.publish_on_complete then
    for r in select recipients.id,exists(select 1 from public.user_roles ur where ur.user_id=recipients.id and ur.role='admin') as admin
      from (select user_id as id from public.user_roles where role='admin' union select s.owner_id where s.owner_id is not null) recipients loop
      insert into public.notifications(recipient_id,store_id,product_id,title,message,href)
        values(r.id,s.id,product,'New product ready to review', (j.template_snapshot->>'title') || ' is ready as a draft for ' || s.name,
          case when r.admin then '/dashboard/admin/stores/'||s.id||'/products' else '/dashboard/store/products' end)
        on conflict(recipient_id,product_id) do nothing returning id into n;
      if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
    end loop;
  end if;
  update public.product_generation_jobs set status='completed',lease_until=null,lease_token=null,last_error=null,updated_at=now() where id=j.id;
  return product;
end; $$;
