-- Worker-only, lease-guarded partial progress writes. No public/authenticated access.
create function public.save_lineup_step(p_job uuid,p_lease uuid,p_patch jsonb,p_batches jsonb,p_remove text[],p_delay_ms integer default 0)
returns uuid language plpgsql set search_path='' as $$
declare j public.product_generation_jobs; next_state jsonb; item record; idx integer;
begin
  select * into j from public.product_generation_jobs where id=p_job and lease_token=p_lease
    and status='running' and lease_until>now() for update;
  if not found then raise exception 'Generation lease expired'; end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_batches) is distinct from 'object' then
    raise exception 'Invalid progress patch';
  end if;
  next_state := (j.state - coalesce(p_remove,array[]::text[])) || p_patch;
  for item in select key,value from jsonb_each(p_batches) loop
    if item.key !~ '^(0|[1-9][0-9]*)$' then raise exception 'Invalid batch index'; end if;
    idx := item.key::integer;
    if jsonb_typeof(next_state->'batches') is distinct from 'array'
       or idx >= jsonb_array_length(next_state->'batches') then
      raise exception 'Invalid batch index';
    end if;
    next_state := jsonb_set(next_state,array['batches',item.key],item.value,false);
  end loop;
  update public.product_generation_jobs set state=next_state,status='pending',attempts=0,last_error=null,
    available_at=now()+make_interval(secs=>greatest(0,least(coalesce(p_delay_ms,0),21600000))::double precision/1000),
    lease_token=null,lease_until=null,updated_at=now() where id=j.id;
  return j.id;
end;
$$;
revoke all on function public.save_lineup_step(uuid,uuid,jsonb,jsonb,text[],integer) from public,anon,authenticated;
grant execute on function public.save_lineup_step(uuid,uuid,jsonb,jsonb,text[],integer) to service_role;
