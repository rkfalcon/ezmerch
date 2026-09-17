-- Supplier stock is separate from every administrator/owner visibility choice.
alter table public.product_templates add column supplier_stock jsonb;
alter table public.product_templates add column stock_check_error text;
alter table public.product_templates add column stock_next_check_at timestamptz not null default now();
alter table public.products add column supplier_stock jsonb;
alter table public.notifications alter column product_id drop not null;
alter table public.notifications alter column store_id drop not null;
alter table public.notifications add column event_key text;
create unique index notification_event_recipient on public.notifications(recipient_id,event_key) where event_key is not null;

create function private.apply_product_stock() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.template_id is not null then
    select supplier_stock into new.supplier_stock from public.product_templates where id=new.template_id;
  elsif tg_op='UPDATE' then new.supplier_stock=old.supplier_stock;
  else new.supplier_stock=null; end if;
  return new;
end; $$;
create trigger product_supplier_stock before insert or update on public.products for each row execute function private.apply_product_stock();

create function public.apply_supplier_stock(p_template uuid,p_stock jsonb) returns void language plpgsql set search_path='' as $$
declare t public.product_templates; p record; r record; n uuid; event text; msg text; prev jsonb;
begin
  select * into t from public.product_templates where id=p_template for update;
  if t.id is null then raise exception 'Template not found'; end if;
  prev=t.supplier_stock;
  -- Reject an older check arriving after a newer one.
  if prev is not null and (prev->>'checkedAt')::timestamptz >= (p_stock->>'checkedAt')::timestamptz then return; end if;
  update public.product_templates set supplier_stock=p_stock,stock_check_error=null,stock_next_check_at=now()+interval '30 minutes' where id=t.id;
  update public.products set supplier_stock=p_stock where template_id=t.id;
  if (prev->'available' is not distinct from p_stock->'available') and (prev->'unavailable' is not distinct from p_stock->'unavailable') and (prev->'discontinued' is not distinct from p_stock->'discontinued') then return; end if;
  -- A healthy initial baseline does not send alerts.
  if prev is null and jsonb_array_length(p_stock->'unavailable')=0 and not (p_stock->>'discontinued')::boolean then return; end if;
  event='stock:'||t.id||':'||gen_random_uuid();
  msg=t.title||case when (p_stock->>'discontinued')::boolean then ' has been discontinued by Printful. Sales are blocked.'
    else ' availability changed: '||jsonb_array_length(p_stock->'unavailable')||' size/color variants unavailable for US delivery. Unavailable variants cannot be purchased; restocked variants follow your existing visibility settings.' end;
  for r in select user_id as id from public.user_roles where role='admin' loop
    insert into public.notifications(recipient_id,title,message,href,event_key) values(r.id,'Printful availability changed',msg,'/dashboard/admin/templates',event) returning id into n;
    insert into public.notification_emails(notification_id) values(n);
  end loop;
  for p in select distinct s.id,s.owner_id from public.stores s join public.products x on x.store_id=s.id where x.template_id=t.id and s.owner_id is not null loop
    -- Admins already receive the global alert.
    if not exists(select 1 from public.user_roles where user_id=p.owner_id and role='admin') then
      insert into public.notifications(recipient_id,store_id,title,message,href,event_key) values(p.owner_id,p.id,'Printful availability changed',msg,'/dashboard/store/products',event||':'||p.id) returning id into n;
      insert into public.notification_emails(notification_id) values(n);
    end if;
  end loop;
end; $$;
revoke all on function public.apply_supplier_stock(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.apply_supplier_stock(uuid,jsonb) to service_role;
revoke all on function private.apply_product_stock() from public,anon,authenticated;

create function private.notify_fulfillment_problem() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; n uuid;
begin
 if new.status not in ('fulfillment_failed','failed') or new.status is not distinct from old.status then return new; end if;
 for r in select recipients.id,exists(select 1 from public.user_roles where user_id=recipients.id and role='admin') as admin
 from (select user_id as id from public.user_roles where role='admin' union select owner_id from public.stores where id=new.store_id and owner_id is not null) recipients loop
  insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
  values(r.id,new.store_id,'Order needs attention','Order '||new.id||' could not be fulfilled. Review the order before retrying or arranging a refund. No substitute product has been ordered.',case when r.admin then '/dashboard/admin/orders' else '/dashboard/store/orders' end,'order-problem:'||new.id||':'||new.status)
  on conflict(recipient_id,event_key) where event_key is not null do nothing returning id into n;
  if n is not null then insert into public.notification_emails(notification_id) values(n); end if;
 end loop;
 return new;
end; $$;
create trigger order_fulfillment_problem after update of status on public.orders for each row execute function private.notify_fulfillment_problem();
revoke all on function private.notify_fulfillment_problem() from public,anon,authenticated;

create or replace function public.claim_lineup_job() returns setof public.product_generation_jobs language plpgsql set search_path='' as $$
begin
  perform pg_advisory_xact_lock(918273);
  if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then return; end if;
  return query update public.product_generation_jobs j set status='running',lease_until=now()+interval '3 minutes',lease_token=gen_random_uuid(),updated_at=now()
    where j.id=(select q.id from public.product_generation_jobs q join public.product_templates t on t.id=q.template_id
      where t.active and not coalesce((t.supplier_stock->>'discontinued')::boolean,false) and q.status in ('pending','running') and q.available_at<=now() and (q.lease_until is null or q.lease_until<now())
      -- Every product without a preview goes ahead of the remaining color batches.
      order by exists(select 1 from jsonb_array_elements(coalesce(q.state->'batches','[]')) b where jsonb_array_length(coalesce(b->'images','[]'))>0 or jsonb_array_length(coalesce(b->'downloadedImages','[]'))>0),
        q.available_at,q.created_at limit 1 for update of q skip locked) returning j.*;
end; $$;

