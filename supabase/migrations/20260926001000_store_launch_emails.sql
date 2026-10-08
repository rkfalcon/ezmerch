-- Reuse the durable outbox. Day zero is delivered first; reminder ages start at delivery.
alter table public.notification_emails drop constraint notification_emails_status_check;
alter table public.notification_emails add constraint notification_emails_status_check
  check(status in ('pending','sent','failed','skipped'));
create function public.enqueue_store_launch_emails() returns void
language plpgsql security definer set search_path='' as $$
declare s record; n uuid; first_sent timestamptz; stage integer; event text;
begin
  for s in select st.* from public.stores st where st.owner_id is not null and st.claimed
    and exists(select 1 from public.products p where p.store_id=st.id and p.published and p.global_active
      and p.thumbnail_url is not null and jsonb_array_length(p.variants)>0)
    and (not st.selling_enabled or not exists(select 1 from public.store_payout_readiness r
      where r.store_id=st.id and r.stripe_account_id=st.stripe_account_id))
  loop
    -- Do not stack reminders while an earlier email is awaiting delivery/retry.
    if exists(select 1 from public.notifications n join public.notification_emails e on e.notification_id=n.id
      where n.store_id=s.id and n.recipient_id=s.owner_id and n.event_key like 'store-launch:%' and e.status='pending') then continue; end if;
    event := 'store-launch:'||s.id||':0';
    select e.sent_at into first_sent from public.notifications n join public.notification_emails e on e.notification_id=n.id
      where n.recipient_id=s.owner_id and n.event_key=event and e.status='sent';
    stage := 0;
    if first_sent is not null then
      select max(d) into stage from unnest(array[1,3,7,14,21,28]) d where now() >= first_sent + d * interval '1 day';
      if stage is null then continue; end if;
    end if;
    event := 'store-launch:'||s.id||':'||stage;
    n := null;
    insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
    values(s.owner_id,s.id,case when stage=0 then 'Your VeryMerch store has products ready' else 'Complete your VeryMerch store setup' end,
      'Launch your store to start selling. Stripe setup is only required to receive payouts. You receive 70% of merchandise profit after product and printing costs; VeryMerch receives 30%. Complete Stripe verification within 30 days of each sale to collect eligible earnings.',
      '/dashboard/onboarding',event)
    on conflict(recipient_id,event_key) where event_key is not null do nothing returning id into n;
    if n is not null then insert into public.notification_emails(notification_id) values(n); end if;
  end loop;
end; $$;
revoke all on function public.enqueue_store_launch_emails() from public,anon,authenticated;
grant execute on function public.enqueue_store_launch_emails() to service_role;
