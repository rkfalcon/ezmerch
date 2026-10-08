-- Separate from resumable fulfillment state so preview writes cannot overwrite worker progress.
alter table public.product_generation_jobs add column quick_preview_url text;
create function public.clear_replaced_quick_preview() returns trigger language plpgsql set search_path='' as $$
begin
 if new.logo_path is distinct from old.logo_path or new.generation_id is distinct from old.generation_id then
  new.quick_preview_url=null;
 end if;
 return new;
end $$;
create trigger clear_replaced_quick_preview before update on public.product_generation_jobs for each row execute function public.clear_replaced_quick_preview();
revoke all on function public.clear_replaced_quick_preview() from public,anon,authenticated;
