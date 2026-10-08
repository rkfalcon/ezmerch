alter table public.stores add column earnings_policy_accepted_at timestamptz, add column earnings_policy_version text;
-- Applies only to payments explicitly tagged with owner-margin-70-30-30days-v1.
-- No historical sales are forfeited or backfilled.
create table public.store_payout_readiness (
  store_id uuid primary key references public.stores(id),
  stripe_account_id text not null,
  qualified_at timestamptz not null
);
create table public.owner_earnings (
  order_id uuid primary key references public.orders(id),
  store_id uuid not null references public.stores(id),
  policy_version text not null default 'owner-margin-70-30-30days-v1',
  sold_at timestamptz not null,
  deadline_at timestamptz not null,
  production_cost_cents integer not null check(production_cost_cents>=0),
  original_owner_cents integer not null check(original_owner_cents>=0),
  owner_cents integer not null check(owner_cents>=0 and owner_cents<=original_owner_cents),
  status text not null default 'pending' check(status in ('pending','eligible','transferred','expired','refunded','disputed','no_margin')),
  stripe_transfer_id text unique,
  transferred_cents integer not null default 0 check(transferred_cents>=0),
  reversed_cents integer not null default 0 check(reversed_cents>=0 and reversed_cents<=transferred_cents),
  qualified_at timestamptz,
  next_check_at timestamptz not null default now(),
  locked_until timestamptz not null default '-infinity',
  lock_token uuid,
  attempts integer not null default 0,
  wake_version integer not null default 0,
  last_error text,
  updated_at timestamptz not null default now(),
  check(deadline_at=sold_at+interval '720 hours')
);
create index owner_earnings_store on public.owner_earnings(store_id,sold_at desc);
create index owner_earnings_due on public.owner_earnings(next_check_at);
alter table public.store_payout_readiness enable row level security;
alter table public.owner_earnings enable row level security;
revoke all on public.store_payout_readiness,public.owner_earnings from anon,authenticated;
grant select on public.store_payout_readiness,public.owner_earnings to authenticated;
grant all on public.store_payout_readiness,public.owner_earnings to service_role;
create policy earnings_read on public.owner_earnings for select to authenticated using(
  exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid()))
  or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);
create policy payout_readiness_read on public.store_payout_readiness for select to authenticated using(
  exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid()))
  or exists(select 1 from public.user_roles r where r.user_id=(select auth.uid()) and r.role='admin')
);

create function public.record_owner_earning(p_order uuid,p_sold_at timestamptz,p_production integer)
returns void language plpgsql set search_path='' as $$
declare o public.orders; share integer;
begin
  select * into strict o from public.orders where id=p_order;
  if p_production<0 or p_production>o.subtotal_cents then raise exception 'Invalid production cost'; end if;
  share := round((o.subtotal_cents-p_production)*0.7);
  insert into public.owner_earnings(order_id,store_id,sold_at,deadline_at,production_cost_cents,original_owner_cents,owner_cents)
  values(o.id,o.store_id,p_sold_at,p_sold_at+interval '720 hours',p_production,share,share)
  on conflict(order_id) do nothing;
end; $$;

-- First successful verification is durable; delayed/out-of-order webhook delivery
-- can move it earlier, never later. Client roles cannot forge this timestamp.
create function public.record_payout_readiness(p_account text,p_at timestamptz)
returns void language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.store_payout_readiness r join public.stores s on s.id=r.store_id
    where s.stripe_account_id=p_account and r.stripe_account_id=p_account and r.qualified_at<=p_at) then return; end if;
  insert into public.store_payout_readiness(store_id,stripe_account_id,qualified_at)
  select id,p_account,p_at from public.stores where stripe_account_id=p_account and claimed=true
  on conflict(store_id) do update set
    qualified_at=case when store_payout_readiness.stripe_account_id=excluded.stripe_account_id
      then least(store_payout_readiness.qualified_at,excluded.qualified_at) else excluded.qualified_at end,
    stripe_account_id=excluded.stripe_account_id;
  update public.owner_earnings e set next_check_at=now(),wake_version=wake_version+1
  from public.store_payout_readiness r where r.store_id=e.store_id and r.stripe_account_id=p_account
    and r.qualified_at<=e.deadline_at and e.status in ('pending','eligible','expired');
end; $$;

create function public.claim_owner_earning() returns setof public.owner_earnings
language sql set search_path='' as $$
  update public.owner_earnings e set locked_until=now()+interval '3 minutes',lock_token=gen_random_uuid(),attempts=e.attempts+1
  where e.order_id=(select q.order_id from public.owner_earnings q
    where q.next_check_at<=now() and q.locked_until<=now()
    order by q.next_check_at limit 1 for update skip locked)
  returning e.*;
$$;

-- Atomic notification/outbox insertion. Unclaimed stores notify admins instead.
create function public.notify_owner_earning(p_order uuid,p_kind text,p_title text,p_message text)
returns void language plpgsql set search_path='' as $$
declare s public.stores; recipient uuid; n uuid;
begin
  select st.* into strict s from public.stores st join public.owner_earnings e on e.store_id=st.id where e.order_id=p_order;
  for recipient in select s.owner_id where s.owner_id is not null
    union select user_id from public.user_roles where role='admin' and (s.owner_id is null or p_kind='issue') loop
    n := null;
    insert into public.notifications(recipient_id,store_id,title,message,href,event_key)
    values(recipient,s.id,p_title,p_message,
      case when recipient=s.owner_id then '/dashboard/store/earnings' else '/dashboard/admin/earnings' end,
      'earnings:'||p_order||':'||p_kind)
    on conflict(recipient_id,event_key) where event_key is not null do nothing returning id into n;
    if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
  end loop;
end; $$;

-- Audit every transition, including refund reductions and late webhook corrections.
create table public.owner_earning_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.owner_earnings(order_id),
  status text not null,
  owner_cents integer not null,
  stripe_transfer_id text,
  reversed_cents integer not null,
  recorded_at timestamptz not null default now()
);
create index owner_earning_events_order on public.owner_earning_events(order_id);
alter table public.owner_earning_events enable row level security;
revoke all on public.owner_earning_events from anon,authenticated;
grant select on public.owner_earning_events to authenticated;
grant all on public.owner_earning_events to service_role;
grant usage,select on sequence public.owner_earning_events_id_seq to service_role;
create policy earning_events_read on public.owner_earning_events for select to authenticated using(
  exists(select 1 from public.owner_earnings e where e.order_id=owner_earning_events.order_id)
);
create function private.audit_owner_earning() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='INSERT' or row(new.status,new.owner_cents,new.stripe_transfer_id,new.reversed_cents)
    is distinct from row(old.status,old.owner_cents,old.stripe_transfer_id,old.reversed_cents) then
    update public.orders set platform_fee_cents=subtotal_cents-new.owner_cents where id=new.order_id;
    insert into public.owner_earning_events(order_id,status,owner_cents,stripe_transfer_id,reversed_cents)
    values(new.order_id,new.status,new.owner_cents,new.stripe_transfer_id,new.reversed_cents);
  end if;
  return new;
end; $$;
revoke all on function private.audit_owner_earning() from public,anon,authenticated;
create trigger owner_earning_audit after insert or update on public.owner_earnings for each row execute function private.audit_owner_earning();
revoke all on function public.record_owner_earning(uuid,timestamptz,integer),public.record_payout_readiness(text,timestamptz),public.claim_owner_earning(),public.notify_owner_earning(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_owner_earning(uuid,timestamptz,integer),public.record_payout_readiness(text,timestamptz),public.claim_owner_earning(),public.notify_owner_earning(uuid,text,text,text) to service_role;

create function public.wake_owner_earning(p_payment text) returns void language sql set search_path='' as $$
  update public.owner_earnings e set next_check_at=now(),wake_version=wake_version+1
  from public.orders o where o.id=e.order_id and o.stripe_payment_intent_id=p_payment;
$$;
revoke all on function public.wake_owner_earning(text) from public,anon,authenticated;
grant execute on function public.wake_owner_earning(text) to service_role;
