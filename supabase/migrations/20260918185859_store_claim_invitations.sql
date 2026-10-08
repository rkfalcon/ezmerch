-- Invitations and email snapshots are server-only, never part of public stores.
create table public.store_invitation_template (
  id boolean primary key default true check (id),
  subject text not null, body text not null, updated_at timestamptz not null default now()
);
create table public.store_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email))),
  token_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz, revoked_at timestamptz,
  email_payload jsonb not null,
  email_status text not null default 'pending' check(email_status in ('pending','sent','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  sent_at timestamptz, resend_id text, last_error text
);
create index store_invitations_store on public.store_invitations(store_id,created_at desc);
create index store_invitations_creator on public.store_invitations(created_by);
create index store_invitations_pending on public.store_invitations(available_at)
  where email_status='pending' and revoked_at is null and accepted_at is null;
create unique index store_invitations_one_active on public.store_invitations(store_id)
  where revoked_at is null and accepted_at is null;
alter table public.store_invitations enable row level security;
alter table public.store_invitation_template enable row level security;
revoke all on public.store_invitations, public.store_invitation_template from anon,authenticated;
grant all on public.store_invitations, public.store_invitation_template to service_role;
-- Retire bearer links stored on the publicly readable stores table.
update public.stores set claim_token=null,claim_token_expires_at=null where claim_token is not null;
revoke all on function public.claim_store(text,uuid) from public,anon,authenticated;

create function public.issue_store_invitation(p_store_id uuid,p_email text,p_hash text,p_creator uuid,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
  perform 1 from public.stores where id=p_store_id and not claimed and owner_id is null for update;
  if not found then raise exception 'This store is already claimed or unavailable.'; end if;
  if exists(select 1 from public.store_invitations where store_id=p_store_id and created_at>now()-interval '1 minute') then
    raise exception 'Please wait one minute before sending another invitation.';
  end if;
  update public.store_invitations set revoked_at=now() where store_id=p_store_id and revoked_at is null and accepted_at is null;
  insert into public.store_invitations(store_id,recipient_email,token_hash,created_by,email_payload)
  values(p_store_id,lower(btrim(p_email)),p_hash,p_creator,p_payload) returning id into v_id;
  return v_id;
end $$;
revoke all on function public.issue_store_invitation(uuid,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.issue_store_invitation(uuid,text,text,uuid,jsonb) to service_role;

create function public.accept_store_invitation(p_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_inv public.store_invitations; v_email text; v_store uuid;
begin
  select lower(btrim(email)) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'Sign in with your verified invited email address.'; end if;
  select store_id into v_store from public.store_invitations where token_hash=p_hash;
  -- Same lock order as issuing invitations; race with resend cannot transfer ownership.
  perform 1 from public.stores where id=v_store for update;
  select * into v_inv from public.store_invitations where token_hash=p_hash for update;
  if v_inv.id is null or v_inv.revoked_at is not null or v_inv.accepted_at is not null or v_inv.expires_at<=now() then
    raise exception 'This invitation is invalid, expired, or already accepted.';
  end if;
  if v_inv.recipient_email<>v_email then raise exception 'Sign in with the email address that received this invitation.'; end if;
  update public.stores set owner_id=auth.uid(),claimed=true,claimed_at=now(),claim_token=null,claim_token_expires_at=null
    where id=v_store and not claimed and owner_id is null;
  if not found then raise exception 'This store has already been claimed.'; end if;
  insert into public.user_roles(user_id,role,store_id) values(auth.uid(),'store_owner',v_store)
    on conflict(user_id,role,store_id) do nothing;
  update public.store_invitations set accepted_at=now() where id=v_inv.id;
  return v_store;
end $$;
revoke all on function public.accept_store_invitation(text) from public,anon;
grant execute on function public.accept_store_invitation(text) to authenticated;

create function public.claim_store_invitation_email(p_id uuid default null)
returns setof public.store_invitations language plpgsql security invoker set search_path='' as $$
begin
  update public.store_invitations set email_status='failed',last_error='Delivery could not be confirmed. Send a new invitation.'
    where email_status='pending' and revoked_at is null and accepted_at is null and available_at<=now()
    and (attempts>=5 or created_at<=now()-interval '23 hours');
  return query update public.store_invitations set attempts=attempts+1,available_at=now()+interval '2 minutes'
  where id=(select id from public.store_invitations where email_status='pending'
    and revoked_at is null and accepted_at is null and expires_at>now()
    and available_at<=now() and (p_id is null or id=p_id)
    and attempts<5 and created_at>now()-interval '23 hours'
    order by available_at limit 1 for update skip locked)
  returning *;
end $$;
revoke all on function public.claim_store_invitation_email(uuid) from public,anon,authenticated;
grant execute on function public.claim_store_invitation_email(uuid) to service_role;
