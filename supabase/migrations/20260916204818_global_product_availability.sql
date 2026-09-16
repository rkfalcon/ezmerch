-- Global limits are separate from store choices. Never overwrite published or enabled_colors.
alter table public.product_templates add column enabled_colors text[];
alter table public.product_templates add constraint template_colors_nonempty
  check (enabled_colors is null or cardinality(enabled_colors) > 0);
alter table public.products add column global_active boolean not null default true;
alter table public.products add column global_enabled_colors text[];

-- Derived columns make availability readable without exposing the admin template table.
-- Always derive them in the database, including writes made directly through the Data API.
create function private.set_product_global_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' and NEW.template_id is distinct from OLD.template_id then
    raise exception 'Product template association cannot be changed';
  end if;
  if NEW.template_id is null then
    NEW.global_active := true;
    NEW.global_enabled_colors := null;
  else
    select t.active, t.enabled_colors into NEW.global_active, NEW.global_enabled_colors
      from public.product_templates t where t.id = NEW.template_id for share;
    if not found then raise exception 'Product template not found'; end if;
  end if;
  return NEW;
end;
$$;
revoke all on function private.set_product_global_availability() from public, anon, authenticated;
create trigger product_global_availability before insert or update on public.products
for each row execute function private.set_product_global_availability();

create function private.propagate_template_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.products set global_active = NEW.active,
    global_enabled_colors = NEW.enabled_colors where template_id = NEW.id;
  return NEW;
end;
$$;
revoke all on function private.propagate_template_availability() from public, anon, authenticated;
create trigger template_global_availability after update of active, enabled_colors on public.product_templates
for each row when (OLD.active is distinct from NEW.active or OLD.enabled_colors is distinct from NEW.enabled_colors)
execute function private.propagate_template_availability();

update public.products set global_active = global_active where template_id is not null;
alter policy "Anyone can view published products" on public.products
using (published = true and global_active = true);
