create table public.artwork_quality_settings (
 id integer primary key check(id=1),
 values jsonb not null check(jsonb_typeof(values)='object'),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.artwork_quality_settings enable row level security;
revoke all on public.artwork_quality_settings from anon,authenticated;
grant all on public.artwork_quality_settings to service_role;
create table public.artwork_quality_settings_history (
 revision integer primary key,
 values jsonb not null,
 updated_at timestamptz not null,
 updated_by uuid references auth.users(id) on delete set null
);
alter table public.artwork_quality_settings_history enable row level security;
revoke all on public.artwork_quality_settings_history from anon,authenticated;
grant all on public.artwork_quality_settings_history to service_role;
create function private.audit_artwork_quality_settings() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then NEW.revision:=OLD.revision+1; end if;
 NEW.updated_at:=now();
 insert into public.artwork_quality_settings_history(revision,values,updated_at,updated_by)
 values(NEW.revision,NEW.values,NEW.updated_at,NEW.updated_by);
 return NEW;
end; $$;
revoke all on function private.audit_artwork_quality_settings() from public,anon,authenticated;
create trigger audit_artwork_quality_settings before insert or update on public.artwork_quality_settings
for each row execute function private.audit_artwork_quality_settings();

insert into public.artwork_quality_settings(id,values) values(1,'{"printTextMm":2.032,"embroideryTextMm":6.35,"minOutputPpi":150,"minEnhancedSourcePpi":75,"embroideryColors":6,"embroideryLineMm":1.27,"embroideryGapMm":6.35,"partialPixelPercent":2,"alphaLow":20,"alphaHigh":235,"edgeSolidPixels":2,"edgeClearPixels":4,"meanDifference":0.06,"tileDifference":0.18,"alphaDifference":0.025,"aspectDifference":0.005,"minDtgScalePercent":1,"minOtherScalePercent":50,"minFrontInches":2.5,"allowEdgeSmoothing":true,"reviewTransparency":true,"growOtherPrints":false}'::jsonb);
