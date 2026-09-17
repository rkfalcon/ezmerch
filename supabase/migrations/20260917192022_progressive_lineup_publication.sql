create or replace function public.publish_lineup_progress(p_job uuid,p_lease uuid,p_sync_id bigint,p_variants jsonb,p_images jsonb) returns uuid language plpgsql set search_path='' as $$
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
      (select old_v->'retail_price' from jsonb_array_elements(existing_product.variants) old_v where old_v->>'variant_id'=v->>'variant_id' limit 1),
      (select to_jsonb(min(old_v->>'retail_price')) from jsonb_array_elements(existing_product.variants) old_v
        where old_v->>'size'=v->>'size' having count(distinct old_v->>'retail_price')=1),v->'retail_price')))
      into p_variants from jsonb_array_elements(p_variants) v;
    -- Regeneration keeps the old artwork for variants that have not finished yet.
    p_images := p_images || coalesce((select jsonb_agg(image) from jsonb_array_elements(existing_product.mockup_images) image
      where not exists(select 1 from jsonb_array_elements(p_images) fresh where fresh->>'url'=image->>'url')), '[]'::jsonb);
    p_variants := p_variants || coalesce((select jsonb_agg(old_v) from jsonb_array_elements(existing_product.variants) old_v
      where not exists(select 1 from jsonb_array_elements(p_variants) fresh where fresh->>'variant_id'=old_v->>'variant_id')), '[]'::jsonb);
    update public.products set printful_sync_product_id=p_sync_id,variants=p_variants,
      thumbnail_url=p_images->0->>'url',mockup_images=p_images,updated_at=now() where id=existing_product.id;

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

  return product;
end; $$;

revoke all on function public.publish_lineup_progress(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.publish_lineup_progress(uuid,uuid,bigint,jsonb,jsonb) to service_role;

-- Shared placement metadata cache; no customer data and no browser access.
create table public.lineup_preview_templates (
  id text primary key, payload jsonb not null, updated_at timestamptz not null default now()
);
alter table public.lineup_preview_templates enable row level security;
revoke all on public.lineup_preview_templates from anon,authenticated;
grant all on public.lineup_preview_templates to service_role;

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
      (select old_v->'retail_price' from jsonb_array_elements(existing_product.variants) old_v where old_v->>'variant_id'=v->>'variant_id' limit 1),
      (select to_jsonb(min(old_v->>'retail_price')) from jsonb_array_elements(existing_product.variants) old_v
        where old_v->>'size'=v->>'size' having count(distinct old_v->>'retail_price')=1),v->'retail_price')))
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
