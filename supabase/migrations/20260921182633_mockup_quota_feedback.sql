-- Supplier feedback can extend the shared reservation; never shorten another worker's wait.
create or replace function public.defer_lineup_mockup_slot(p_delay_ms integer) returns void
language sql security invoker set search_path='' as $$
 update private.printful_mockup_pacing
 set next_at=greatest(next_at,clock_timestamp()+make_interval(secs=>least(300000,greatest(0,p_delay_ms))/1000.0))
 where id=true;
$$;
revoke all on function public.defer_lineup_mockup_slot(integer) from public,anon,authenticated;
grant execute on function public.defer_lineup_mockup_slot(integer) to service_role;
