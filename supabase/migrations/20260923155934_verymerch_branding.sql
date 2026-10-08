-- Durable admin-only alerts, inserted atomically with a failed generation.
create or replace function private.notify_artwork_failure() returns trigger
language plpgsql security definer set search_path='' as $$
declare store_name text;
begin
  if new.status <> 'failed' then return new; end if;
  select name into store_name from public.stores where id=new.store_id;
  perform private.notify_admins(
    'Artwork needs VeryMerch attention: '||coalesce(store_name,'Store'),
    coalesce(new.template_snapshot->>'title','Product')||': '||coalesce(new.last_error,'Generation could not finish.')||
    ' The store owner is not being asked to fix this. Review the artwork and print dimensions in the admin store dashboard; approve a reviewable design or replace the artwork/update its template and regenerate.',
    '/dashboard/admin/stores/'||new.store_id,
    'artwork-attention:'||coalesce(new.generation_id,new.id)::text,
    new.store_id
  );
  return new;
end; $$;
revoke all on function private.notify_artwork_failure() from public,anon,authenticated;

-- Rebrand saved copy without restarting jobs or sending notifications.
update public.notifications set
 title=replace(replace(title,'EZMerch','VeryMerch'),'EzMerch','VeryMerch'),
 message=replace(replace(message,'EZMerch','VeryMerch'),'EzMerch','VeryMerch')
where title ~ 'EZMerch|EzMerch' or message ~ 'EZMerch|EzMerch';
update public.store_invitation_template set
 subject=replace(replace(replace(subject,'ezmerch.store','verymerch.com'),'EzMerch','VeryMerch'),'EZMerch','VeryMerch'),
 body=replace(replace(replace(body,'ezmerch.store','verymerch.com'),'EzMerch','VeryMerch'),'EZMerch','VeryMerch');
update public.store_website_email_template set
 subject=replace(replace(replace(subject,'ezmerch.store','verymerch.com'),'EzMerch','VeryMerch'),'EZMerch','VeryMerch'),
 body=replace(replace(replace(body,'ezmerch.store','verymerch.com'),'EzMerch','VeryMerch'),'EZMerch','VeryMerch');
