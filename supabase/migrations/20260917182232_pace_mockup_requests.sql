-- Printful permits only two mockup task creations per minute for new stores.
-- Coordinate the shared credential across cron and upload-triggered workers.
create table private.printful_mockup_pacing (
  id boolean primary key default true check(id),
  next_at timestamptz not null default now()
);
alter table private.printful_mockup_pacing enable row level security;
revoke all on private.printful_mockup_pacing from public,anon,authenticated;
grant select,update on private.printful_mockup_pacing to service_role;
insert into private.printful_mockup_pacing(id) values(true);
create function public.reserve_lineup_mockup_slot() returns integer language plpgsql set search_path='' as $$
declare ready_at timestamptz; slot_time timestamptz:=clock_timestamp();
begin
 select next_at into ready_at from private.printful_mockup_pacing where id=true for update;
 if ready_at>slot_time then return ceil(extract(epoch from ready_at-slot_time)*1000)::integer; end if;
 update private.printful_mockup_pacing set next_at=slot_time+interval '32 seconds' where id=true;
 return 0;
end; $$;
revoke all on function public.reserve_lineup_mockup_slot() from public,anon,authenticated;
grant execute on function public.reserve_lineup_mockup_slot() to service_role;
-- Stock shortages should wait for replenishment, not exhaust failure retries.
update public.product_generation_jobs set status='pending',attempts=0,available_at=now()+interval '6 hours'
where status in ('pending','failed') and last_error='No available variants for this product';
