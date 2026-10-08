-- Refresh only global color selection; retain per-store artwork adjustments.
create or replace function private.refresh_generation_colors() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or new.generation_id is distinct from old.generation_id
     or new.logo_path is distinct from old.logo_path then
    select new.template_snapshot || jsonb_build_object('enabled_colors',t.enabled_colors)
      into new.template_snapshot from public.product_templates t where t.id=new.template_id;
  end if;
  return new;
end; $$;
revoke all on function private.refresh_generation_colors() from public,anon,authenticated;
create trigger refresh_generation_colors before insert or update of generation_id,logo_path
on public.product_generation_jobs for each row execute function private.refresh_generation_colors();
