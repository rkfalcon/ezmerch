alter table public.stores
  add column banner_color text,
  add column banner_subtitle text,
  add constraint stores_banner_color_valid check (banner_color is null or banner_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint stores_banner_subtitle_length check (banner_subtitle is null or char_length(banner_subtitle) <= 240);
-- Null keeps the existing banner appearance and default copy; empty subtitle hides the copy.
