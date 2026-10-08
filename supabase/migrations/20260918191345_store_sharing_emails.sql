create table public.store_website_email_template (
 id boolean primary key default true check(id),
 subject text not null, body text not null, updated_at timestamptz not null default now()
);
create table public.store_website_emails (
 id uuid primary key,
 store_id uuid not null references public.stores(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 recipient_email text not null,
 created_at timestamptz not null default now(),
 email_payload jsonb not null,
 email_status text not null default 'pending' check(email_status in ('pending','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(),
 sent_at timestamptz, resend_id text, last_error text
);
create index store_website_emails_store on public.store_website_emails(store_id,created_at desc);
create index store_website_emails_sender on public.store_website_emails(created_by,created_at desc);
create index store_website_emails_pending on public.store_website_emails(available_at) where email_status='pending';
alter table public.store_website_email_template enable row level security;
alter table public.store_website_emails enable row level security;
revoke all on public.store_website_email_template,public.store_website_emails from anon,authenticated;
grant all on public.store_website_email_template,public.store_website_emails to service_role;

create function public.queue_store_website_email(p_id uuid,p_store uuid,p_user uuid,p_email text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare previous public.store_website_emails;
begin
 -- Serializes per-owner send limits across stores; no network calls in this transaction.
 perform 1 from auth.users where id=p_user and email_confirmed_at is not null for update;
 if not found then raise exception 'Verify your email before sending instructions.'; end if;
 perform 1 from public.stores where id=p_store and owner_id=p_user and claimed;
 if not found then raise exception 'You can only send instructions for a store you own.'; end if;
 select * into previous from public.store_website_emails where id=p_id;
 if found then
   if previous.created_by=p_user and previous.store_id=p_store and previous.recipient_email=lower(btrim(p_email)) then return previous.id; end if;
   raise exception 'This email request is not available.';
 end if;
 if exists(select 1 from public.store_website_emails where created_by=p_user and created_at>now()-interval '1 minute') then
  raise exception 'Please wait one minute before sending another email.';
 end if;
 if (select count(*) from public.store_website_emails where created_by=p_user and created_at>now()-interval '1 hour')>=5 then
  raise exception 'You can send up to five instruction emails per hour. Please try again later or copy the instructions.';
 end if;
 insert into public.store_website_emails(id,store_id,created_by,recipient_email,email_payload)
 values(p_id,p_store,p_user,lower(btrim(p_email)),p_payload);
 return p_id;
end $$;
revoke all on function public.queue_store_website_email(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.queue_store_website_email(uuid,uuid,uuid,text,jsonb) to service_role;

create function public.claim_store_website_email(p_id uuid default null)
returns setof public.store_website_emails language plpgsql security invoker set search_path='' as $$
begin
 update public.store_website_emails set email_status='failed',last_error='Delivery could not be confirmed. Send a new email.'
 where email_status='pending' and available_at<=now() and (attempts>=5 or created_at<=now()-interval '23 hours');
 return query update public.store_website_emails set attempts=attempts+1,available_at=now()+interval '2 minutes'
 where id=(select id from public.store_website_emails where email_status='pending' and available_at<=now()
  and (p_id is null or id=p_id) and attempts<5 and created_at>now()-interval '23 hours'
  order by available_at limit 1 for update skip locked)
 returning *;
end $$;
revoke all on function public.claim_store_website_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_store_website_email(uuid) to service_role;
