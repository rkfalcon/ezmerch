-- Transaction-only integration verification. No email or product change is committed.
begin;
do $$
declare job uuid := 'fbe5c143-213a-4235-9eae-e0b7a5a3d378'; product uuid := 'eb9b2986-505d-4d0c-bf4e-914c76c4f9c3'; before_count int; after_count int; reviewer uuid;
begin
 select user_id into reviewer from public.user_roles where role='admin' limit 1;
 if reviewer is null then raise exception 'Admin fixture missing'; end if;
 select count(*) into before_count from public.notifications where event_key like 'review-enabled:'||job||':%';
 update public.product_generation_jobs set state=jsonb_set(state,'{printQuality}',(state->'printQuality')||jsonb_build_object('status','review','reviewedBy',reviewer,'reviewedAt',clock_timestamp())) where id=job;
 if not found then raise exception 'Job fixture missing'; end if;
 update public.products set variants=variants where id=product;
 select count(*) into after_count from public.notifications n join public.notification_emails e on e.notification_id=n.id where n.event_key like 'review-enabled:'||job||':%';
 if after_count<>before_count+1 then raise exception 'Expected one queued email, before %, after %',before_count,after_count; end if;
 update public.products set variants=variants where id=product;
 if (select count(*) from public.notifications where event_key like 'review-enabled:'||job||':%')<>after_count then raise exception 'Duplicate notification'; end if;
end $$;
rollback;
