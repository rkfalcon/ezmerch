-- The current admin template is authoritative, including when an older job publishes.
create function private.product_template_description() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.template_id is not null then
    select t.description into new.description from public.product_templates t where t.id=new.template_id for share;
  end if;
  return new;
end;
$$;
create trigger product_template_description before insert or update of description,template_id on public.products
for each row execute function private.product_template_description();

create function private.sync_template_description() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.products set description=new.description where template_id=new.id;
  return new;
end;
$$;
create trigger sync_template_description after update of description on public.product_templates
for each row when (old.description is distinct from new.description)
execute function private.sync_template_description();

update public.products p set description=t.description from public.product_templates t
where p.template_id=t.id and p.description is distinct from t.description;
