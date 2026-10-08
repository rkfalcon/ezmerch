-- Track new approvals separately so deploying this does not email historical reviews.
alter table public.product_generation_jobs add column owner_review_approval_at timestamptz;
create function private.track_owner_review_approval() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.generation_id is distinct from old.generation_id or new.logo_path is distinct from old.logo_path then
    new.owner_review_approval_at := null;
  elsif new.state->'printQuality'->>'reviewedAt' is distinct from old.state->'printQuality'->>'reviewedAt'
    and new.state->'printQuality'->>'status'='review'
    and nullif(new.state->'printQuality'->>'reviewedBy','') is not null
    and nullif(new.state->'printQuality'->>'reviewedAt','') is not null then
    new.owner_review_approval_at := (new.state->'printQuality'->>'reviewedAt')::timestamptz;
  end if;
  return new;
end; $$;
revoke all on function private.track_owner_review_approval() from public,anon,authenticated;
create trigger track_owner_review_approval before update of state,generation_id,logo_path
on public.product_generation_jobs for each row execute function private.track_owner_review_approval();

create function private.notify_reviewed_product_enabled() returns trigger
language plpgsql security definer set search_path='' as $$
declare j public.product_generation_jobs; s public.stores; n uuid; label text;
begin
  if not new.published or not new.global_active then return new; end if;
  select * into j from public.product_generation_jobs where store_id=new.store_id and template_id=new.template_id;
  if j.owner_review_approval_at is null or nullif(j.state->'printQuality'->>'reviewedAt','') is null then return new; end if;
  select * into s from public.stores where id=new.store_id;
  if s.owner_id is null or s.lineup_logo_path is distinct from j.logo_path then return new; end if;
  if coalesce((new.supplier_stock->>'discontinued')::boolean,false) then return new; end if;
  if not exists(select 1 from jsonb_array_elements(new.variants) v where
    coalesce((v->>'artwork_pending')::boolean,false)=false
    and nullif(v->>'image_url','') is not null
    and nullif(v->>'sync_variant_id','') is not null
    and (new.enabled_colors is null or coalesce(nullif(btrim(v->>'color'),''),'Default')=any(new.enabled_colors))
    and (new.global_enabled_colors is null or coalesce(nullif(btrim(v->>'color'),''),'Default')=any(new.global_enabled_colors))
    and not coalesce(new.supplier_stock->'unavailable' @> jsonb_build_array((v->>'variant_id')::bigint),false)
    and (new.supplier_stock->'available' is null or new.supplier_stock->'available'='null'::jsonb or new.supplier_stock->'available' @> jsonb_build_array((v->>'variant_id')::bigint))) then return new; end if;
  label := split_part(new.title,' | ',1);
  -- product_id remains null: its unique constraint is reserved for new-product notices.
  insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
  values(s.owner_id,s.id,'Product approved and enabled: '||label,
    'VeryMerch has approved the artwork for '||label||' in '||s.name||'. The product is now enabled in your store, with at least one color ready. You can manage its colors and price in your Products dashboard. Any remaining color previews will continue processing. If your store is not yet live, complete your store setup before customers can purchase.',
    '/dashboard/store/products','review-enabled:'||j.id||':'||coalesce(j.generation_id,j.id)||':'||j.owner_review_approval_at)
  on conflict(recipient_id,event_key) where event_key is not null do nothing returning id into n;
  if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
  return new;
end; $$;
revoke all on function private.notify_reviewed_product_enabled() from public,anon,authenticated;
create trigger reviewed_product_enabled after insert or update of variants,published,global_active,enabled_colors,global_enabled_colors,supplier_stock
on public.products for each row execute function private.notify_reviewed_product_enabled();
