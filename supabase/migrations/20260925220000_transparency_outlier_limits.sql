-- Add bounded transparency-artifact tolerances while preserving admin settings.
update public.artwork_quality_settings
set values = '{"edgeOutlierPercent":0.5,"edgeOutlierVisiblePercent":0.05,"edgeOutlierClusterPixels":64}'::jsonb || values
where id=1;
