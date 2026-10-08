-- Keep previous variants for price preservation and order references, but stop new sales.
create function private.hold_previous_artwork() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.generation_id is distinct from old.generation_id or new.logo_path is distinct from old.logo_path then
    update public.products p set variants=coalesce((select jsonb_agg(v||'{"artwork_pending":true}'::jsonb)
      from jsonb_array_elements(p.variants) v),'[]'::jsonb),updated_at=now()
      where p.store_id=new.store_id and p.template_id=new.template_id;
  end if;
  return new;
end; $$;
revoke all on function private.hold_previous_artwork() from public,anon,authenticated;
create trigger regeneration_hold_previous_artwork after update of generation_id,logo_path on public.product_generation_jobs
for each row execute function private.hold_previous_artwork();

-- Apply to in-progress regenerations. Already-published images from this generation stay enabled.
update public.products p set variants=coalesce((select jsonb_agg(
  case when exists(select 1 from jsonb_array_elements(coalesce(j.state->'batches','[]')) b
    cross join lateral jsonb_array_elements(coalesce(b->'images','[]')) image
    where image->>'url'=v->>'image_url') then v- 'artwork_pending'
  else v||'{"artwork_pending":true}'::jsonb end)
  from jsonb_array_elements(p.variants) v),'[]'::jsonb),updated_at=now()
from public.product_generation_jobs j
where j.store_id=p.store_id and j.template_id=p.template_id and j.status<>'completed';
