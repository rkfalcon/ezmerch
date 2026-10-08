-- Normalize generated, regenerated and edited prices against the current template.
create function public.enforce_template_price_floor()
returns trigger language plpgsql security definer set search_path='' as $$
declare t public.product_templates; v jsonb; result jsonb := '[]'; floor_cents numeric; size_key text;
begin
  if TG_OP='UPDATE' and old.template_id is not null and new.template_id is distinct from old.template_id then
    raise exception 'A template product cannot change its template';
  end if;
  if new.template_id is null then return new; end if;
  select * into t from public.product_templates where id=new.template_id for share;
  if not found then raise exception 'Product template not found'; end if;
  for v in select value from jsonb_array_elements(new.variants) loop
    size_key := replace(regexp_replace(lower(coalesce(nullif(btrim(v->>'size'),''),'One size')), '["″\s]', '', 'g'), '×', 'x');
    floor_cents := coalesce((t.size_prices->>size_key)::numeric,t.retail_price_cents);
    if lower(v->>'retail_price') in ('nan','infinity','-infinity') then
      raise exception 'Enter a finite retail price';
    end if;
    if v->>'retail_price' is null or (v->>'retail_price')::numeric*100 < floor_cents then
      v := jsonb_set(v,'{retail_price}',to_jsonb((floor_cents/100)::numeric(12,2)::text));
    end if;
    result := result || jsonb_build_array(v);
  end loop;
  new.variants := result;
  return new;
end $$;
revoke all on function public.enforce_template_price_floor() from public,anon,authenticated;
create trigger enforce_template_price_floor before insert or update of variants,template_id on public.products
for each row execute function public.enforce_template_price_floor();

create function public.refresh_template_price_floor()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.products set variants=variants where template_id=new.id;
  return new;
end $$;
revoke all on function public.refresh_template_price_floor() from public,anon,authenticated;
create trigger refresh_template_price_floor after update of retail_price_cents,size_prices on public.product_templates
for each row when (old.retail_price_cents is distinct from new.retail_price_cents or old.size_prices is distinct from new.size_prices)
execute function public.refresh_template_price_floor();

update public.products set variants=variants where template_id is not null;
