alter table public.product_generation_jobs add column quick_preview_plan jsonb;

create function private.notify_lineup_completion() returns trigger
language plpgsql security definer set search_path='' as $$
declare s public.stores; n uuid; r record; event text; msg text; purchasable boolean;
begin
  if new.status <> 'completed' then return new; end if;
  select * into s from public.stores where id=new.store_id;
  if s.lineup_logo_path is distinct from new.logo_path then return new; end if;
  if exists(select 1 from public.product_generation_jobs j join public.product_templates t on t.id=j.template_id
    where j.store_id=s.id and t.active and (j.status<>'completed' or j.logo_path is distinct from s.lineup_logo_path)) then return new; end if;
  select 'lineup-complete:'||s.id||':'||md5(string_agg(coalesce(j.generation_id,j.id)::text,',' order by j.id)) into event
    from public.product_generation_jobs j join public.product_templates t on t.id=j.template_id where j.store_id=s.id and t.active;
  if event is null then return new; end if;
  purchasable := s.selling_enabled and not exists(
    select 1 from public.product_generation_jobs j join public.product_templates t on t.id=j.template_id
      left join public.products p on p.store_id=j.store_id and p.template_id=j.template_id
    where j.store_id=s.id and t.active and (p.id is null or not p.published or not p.global_active));
  msg := 'Product preparation is complete for '||s.name||'. All currently available, enabled color variants have finished generating. '||
    case when purchasable then 'Your products are ready for customers to purchase.'
    else 'View your products and finish any publishing or store-launch steps before customers can purchase.' end||
    ' Colors that Printful cannot currently supply remain unavailable.';
  for r in select s.owner_id as id where s.owner_id is not null union select user_id from public.user_roles where role='admin' loop
    n := null;
    insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
      values(r.id,s.id,'Your product lineup is ready: '||s.name,msg,
        case when r.id=s.owner_id then '/dashboard/store/products' else '/dashboard/admin/stores/'||s.id end,event)
      on conflict(recipient_id,event_key) where event_key is not null do nothing returning id into n;
    if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
  end loop;
  return new;
end; $$;
revoke all on function private.notify_lineup_completion() from public,anon,authenticated;
create trigger lineup_complete_notify after update of status on public.product_generation_jobs
for each row execute function private.notify_lineup_completion();
