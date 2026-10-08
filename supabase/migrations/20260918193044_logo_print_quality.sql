create table public.logo_preparations (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 source_hash text not null,
 created_at timestamptz not null default now(),
 status text not null default 'clean' check(status in ('clean','submitting','queued','enhanced','failed')),
 metadata jsonb not null,
 warnings jsonb not null default '[]',
 fal_request jsonb,
 enhanced_metadata jsonb,
 enhancement_started_at timestamptz,
 last_error text,
 unique(user_id,source_hash)
);
create index logo_preparations_user_created on public.logo_preparations(user_id,created_at desc);
alter table public.logo_preparations enable row level security;
revoke all on public.logo_preparations from anon,authenticated;
grant all on public.logo_preparations to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('logo-originals','logo-originals',false,41943040,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
create function public.reserve_logo_enhancement(p_id uuid,p_user uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user::text,918));
 if (select count(*) from public.logo_preparations where user_id=p_user and enhancement_started_at>now()-interval '24 hours')>=10 then
 raise exception 'You can enhance up to ten logos per day. Reuse an enhanced logo or try again tomorrow.'; end if;
 update public.logo_preparations set status='submitting',enhancement_started_at=now()
 where id=p_id and user_id=p_user and status='clean';
 return found;
end $$;
revoke all on function public.reserve_logo_enhancement(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reserve_logo_enhancement(uuid,uuid) to service_role;
-- Small immutable quality sidecars accompany approved print masters; no user data or secrets.
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','application/json'],file_size_limit=41943040 where id='lineup-assets';
