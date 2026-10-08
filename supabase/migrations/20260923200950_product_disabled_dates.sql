alter table public.product_templates add column disabled_at timestamptz;
alter table public.products add column global_disabled_at timestamptz;
create function private.track_template_disabled_date() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='INSERT' then
   NEW.disabled_at := case when NEW.active then null else now() end;
 elsif OLD.active and not NEW.active then NEW.disabled_at := now();
 elsif not OLD.active and NEW.active then NEW.disabled_at := null;
 else NEW.disabled_at := OLD.disabled_at;
 end if;
 return NEW;
end; $$;
revoke all on function private.track_template_disabled_date() from public,anon,authenticated;
create trigger template_disabled_date before insert or update on public.product_templates
for each row execute function private.track_template_disabled_date();
create function private.set_product_disabled_date() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 NEW.global_disabled_at := null;
 if NEW.template_id is not null then
   select case when not t.active then t.disabled_at else null end into NEW.global_disabled_at
   from public.product_templates t where t.id=NEW.template_id;
 end if;
 return NEW;
end; $$;
revoke all on function private.set_product_disabled_date() from public,anon,authenticated;
create trigger product_disabled_date before insert or update on public.products
for each row execute function private.set_product_disabled_date();
-- Historical dates were not recorded. Leave them null rather than inventing dates.
