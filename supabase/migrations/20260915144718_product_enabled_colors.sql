-- NULL preserves the existing behavior: every catalog color is available.
alter table public.products add column enabled_colors text[];
alter table public.products add constraint products_enabled_colors_nonempty
  check (enabled_colors is null or cardinality(enabled_colors) > 0);
