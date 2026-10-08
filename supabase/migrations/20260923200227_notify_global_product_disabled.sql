-- Email only owners who had this product enabled when the admin disabled it.
-- Keep product_id null: recipient/product uniqueness is reserved for ready notices.
create function private.notify_global_product_disabled() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record; n uuid; event text := 'template-disabled:' || NEW.id || ':' || gen_random_uuid();
begin
  if OLD.active and not NEW.active then
    for r in select p.store_id,s.owner_id,s.name from public.products p
      join public.stores s on s.id=p.store_id
      where p.template_id=NEW.id and p.published and p.global_active and s.owner_id is not null
    loop
      insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
      values(r.owner_id,r.store_id,'Product disabled: ' || split_part(NEW.title,' | ',1),
        split_part(NEW.title,' | ',1) || ' has been disabled by VeryMerch and is no longer available for purchase in ' || r.name || '. If you have any concerns, contact help@verymerch.com.',
        '/dashboard/store/products',event || ':' || r.store_id)
      returning id into n;
      insert into public.notification_emails(notification_id) values(n);
    end loop;
  end if;
  return NEW;
end;
$$;
revoke all on function private.notify_global_product_disabled() from public,anon,authenticated;
create trigger template_disabled_notification before update of active on public.product_templates
for each row when (OLD.active and not NEW.active)
execute function private.notify_global_product_disabled();
