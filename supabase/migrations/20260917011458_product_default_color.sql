alter table public.products add column default_color text;
alter table public.products add constraint products_default_color_valid
  check (default_color is null or (char_length(default_color) between 1 and 120 and default_color = btrim(default_color)));
-- This preference is per store product. Availability still overrides it without erasing it.
