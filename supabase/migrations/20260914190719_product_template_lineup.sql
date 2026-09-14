-- Additive: existing stores/products/orders are preserved.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.lineup_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles where user_id=(select auth.uid()) and role='admin');
$$;
revoke all on function private.lineup_admin() from public;
grant execute on function private.lineup_admin() to authenticated, service_role;

alter table public.stores add column lineup_logo_path text;
create table public.product_templates (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  category text not null,
  description text not null default '',
  catalog_product_id integer,
  catalog_match text not null,
  retail_price_cents integer not null check (retail_price_cents > 0),
  size_prices jsonb not null default '{}',
  placement text not null default 'front',
  technique text not null default 'dtg',
  scale numeric not null default 0.8 check (scale > 0 and scale <= 1),
  option_groups jsonb not null default '[]',
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.products add column template_id uuid references public.product_templates(id);
alter table public.products add column mockup_images jsonb not null default '[]';
create unique index products_store_template on public.products(store_id,template_id) where template_id is not null;

create table public.product_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  template_id uuid not null references public.product_templates(id),
  template_snapshot jsonb not null,
  logo_path text not null,
  publish_on_complete boolean not null,
  status text not null default 'pending' check(status in ('pending','running','failed','completed')),
  state jsonb not null default '{}',
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id,template_id)
);
create index generation_ready on public.product_generation_jobs(available_at) where status in ('pending','running');
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  title text not null,
  message text not null,
  href text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(recipient_id,product_id)
);
create index notifications_recipient on public.notifications(recipient_id,created_at desc);
create table public.notification_emails (
  notification_id uuid primary key references public.notifications(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  attempts integer not null default 0,
  last_error text,
  available_at timestamptz not null default now(),
  sent_at timestamptz
);

create function public.claim_lineup_email() returns setof public.notification_emails language sql set search_path='' as $$
  update public.notification_emails e set available_at=now()+interval '3 minutes',attempts=e.attempts+1
  where e.notification_id=(select q.notification_id from public.notification_emails q where q.status='pending' and q.available_at<=now()
    order by q.available_at limit 1 for update skip locked) returning e.*;
$$;
revoke all on function public.claim_lineup_email() from public,anon,authenticated;
grant execute on function public.claim_lineup_email() to service_role;

alter table public.product_templates enable row level security;
alter table public.product_generation_jobs enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_emails enable row level security;
revoke all on public.product_templates,public.product_generation_jobs,public.notifications,public.notification_emails from anon,authenticated;
grant select on public.product_templates,public.product_generation_jobs,public.notifications to authenticated;
grant update(read_at) on public.notifications to authenticated;
grant all on public.product_templates,public.product_generation_jobs,public.notifications,public.notification_emails to service_role;
create policy templates_admin on public.product_templates for select to authenticated using(private.lineup_admin());
create policy jobs_store on public.product_generation_jobs for select to authenticated using(
  private.lineup_admin() or exists(select 1 from public.stores s where s.id=store_id and s.owner_id=(select auth.uid()))
);
create policy notifications_recipient on public.notifications for select to authenticated using(recipient_id=(select auth.uid()));
create policy notifications_read on public.notifications for update to authenticated using(recipient_id=(select auth.uid())) with check(recipient_id=(select auth.uid()));

create function private.enqueue_store_lineup(p_store uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.stores; initial boolean;
begin
  select * into s from public.stores where id=p_store for update;
  if s.lineup_logo_path is null then return; end if;
  initial := not exists(select 1 from public.products where store_id=s.id);
  insert into public.product_generation_jobs(store_id,template_id,template_snapshot,logo_path,publish_on_complete)
    select s.id,t.id,to_jsonb(t),s.lineup_logo_path,initial from public.product_templates t where t.active
    and not exists(select 1 from public.products p where p.store_id=s.id and p.template_id=t.id)
    on conflict(store_id,template_id) do nothing;
end; $$;
revoke all on function private.enqueue_store_lineup(uuid) from public,anon,authenticated;

create function private.store_logo_lineup() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.lineup_logo_path is not null then perform private.enqueue_store_lineup(new.id); end if;
  return new;
end; $$;
revoke all on function private.store_logo_lineup() from public,anon,authenticated;
create trigger store_logo_lineup after insert or update of lineup_logo_path on public.stores for each row execute function private.store_logo_lineup();

create function private.template_lineup() returns trigger language plpgsql security definer set search_path='' as $$
declare s record;
begin
  if new.active and (tg_op='INSERT' or not old.active) then
    for s in select id from public.stores where lineup_logo_path is not null order by id loop
      perform private.enqueue_store_lineup(s.id);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.template_lineup() from public,anon,authenticated;
create trigger template_lineup after insert or update of active on public.product_templates for each row execute function private.template_lineup();

create function public.activate_lineup_templates(p_templates jsonb) returns void language sql set search_path='' as $$
  update public.product_templates t set active=true,catalog_product_id=(v->>'catalog_product_id')::integer,placement=v->>'placement'
  from jsonb_array_elements(p_templates) v where t.id=(v->>'id')::uuid and not t.active;
$$;
revoke all on function public.activate_lineup_templates(jsonb) from public,anon,authenticated;
grant execute on function public.activate_lineup_templates(jsonb) to service_role;

create function public.claim_lineup_job() returns setof public.product_generation_jobs language plpgsql set search_path='' as $$
begin
  -- Serialize claims across server instances; avoid overlapping Printful requests.
  perform pg_advisory_xact_lock(918273);
  if exists(select 1 from public.product_generation_jobs where status='running' and lease_until>now()) then return; end if;
  return query update public.product_generation_jobs j set status='running', lease_until=now()+interval '3 minutes', lease_token=gen_random_uuid(),updated_at=now()
    where j.id=(select q.id from public.product_generation_jobs q join public.product_templates t on t.id=q.template_id
      where t.active and q.status in ('pending','running') and q.available_at<=now() and (q.lease_until is null or q.lease_until<now())
      order by q.available_at,q.created_at limit 1 for update of q skip locked) returning j.*;
end; $$;
revoke all on function public.claim_lineup_job() from public,anon,authenticated;
grant execute on function public.claim_lineup_job() to service_role;

create function public.complete_lineup_job(p_job uuid,p_lease uuid,p_sync_id bigint,p_variants jsonb,p_images jsonb) returns uuid language plpgsql set search_path='' as $$
declare j public.product_generation_jobs; s public.stores; product uuid; r record; n uuid;
begin
  select * into j from public.product_generation_jobs where id=p_job and lease_token=p_lease and status='running' and lease_until>now() for update;
  if j.id is null then raise exception 'Generation lease expired'; end if;
  if jsonb_array_length(p_variants)=0 or jsonb_array_length(p_images)=0 then raise exception 'Products need variants and branded images'; end if;
  select * into s from public.stores where id=j.store_id;
  insert into public.products(store_id,template_id,title,description,printful_sync_product_id,variants,thumbnail_url,mockup_images,published)
    values(j.store_id,j.template_id,j.template_snapshot->>'title',j.template_snapshot->>'description',p_sync_id,p_variants,p_images->0->>'url',p_images,j.publish_on_complete)
    on conflict(store_id,template_id) where template_id is not null do nothing returning id into product;
  if product is not null and not j.publish_on_complete then
    for r in select recipients.id,exists(select 1 from public.user_roles ur where ur.user_id=recipients.id and ur.role='admin') as admin
      from (select user_id as id from public.user_roles where role='admin' union select s.owner_id where s.owner_id is not null) recipients loop
      insert into public.notifications(recipient_id,store_id,product_id,title,message,href)
        values(r.id,s.id,product,'New product ready to review', (j.template_snapshot->>'title') || ' is ready as a draft for ' || s.name,
          case when r.admin then '/dashboard/admin/stores/'||s.id||'/products' else '/dashboard/store/products' end)
        on conflict(recipient_id,product_id) do nothing returning id into n;
      if n is not null then insert into public.notification_emails(notification_id) values(n) on conflict do nothing; end if;
    end loop;
  end if;
  update public.product_generation_jobs set status='completed',lease_until=null,lease_token=null,last_error=null,updated_at=now() where id=j.id;
  return product;
end; $$;
revoke all on function public.complete_lineup_job(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.complete_lineup_job(uuid,uuid,bigint,jsonb,jsonb) to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('lineup-assets','lineup-assets',true,20971520,array['image/png','image/jpeg','image/webp']) on conflict(id) do nothing;
-- Assets are public for Printful; writes go through the authorized server only.

insert into public.product_templates(slug,title,category,catalog_match,retail_price_cents,placement,technique,size_prices) values
('hoodie','Unisex Heavy Blend Hoodie | Gildan 18500','Hoodies & Sweatshirts','18500',3100,'front','dtg','{}'),
('t-shirt','Unisex Staple T-Shirt | Bella + Canvas 3001','T-Shirts','3001',2000,'front','dtg','{}'),
('water-bottle','Stainless Steel Water Bottle with a Straw Lid','Home & Living','Stainless Steel Water Bottle with a Straw Lid',3000,'default','sublimation','{}'),
('dad-hat','Classic Dad Hat | Yupoong 6245CM','Hats & Beanies','6245CM',2300,'embroidery_front','embroidery','{}'),
('beanie','Cuffed Beanie | Yupoong 1501KC','Hats & Beanies','1501KC',2200,'embroidery_front','embroidery','{}'),
('tote','Cotton Color Tote Bag | Westford Mill W101','Bags & Accessories','W101',1900,'front','dtg','{}'),
('long-sleeve','Unisex Long Sleeve Tee | Bella + Canvas 3501','Long Sleeve Shirts','3501',2700,'front','dtg','{}'),
('tank','Men''s Premium Tank Top | Cotton Heritage MC1790','Tank Tops','MC1790',2500,'front','dtg','{}'),
('stickers','Kiss-Cut Stickers','Stickers & Patches','Kiss-Cut Stickers',600,'default','sublimation','{"3x3":600,"4x4":700,"5.5x5.5":700,"15x3.75":900}');
