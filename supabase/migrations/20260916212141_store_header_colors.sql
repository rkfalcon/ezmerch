alter table public.stores
  add column header_color text,
  add column header_text_color text,
  add column banner_text_color text,
  add constraint stores_header_color_valid check(header_color is null or header_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint stores_header_text_color_valid check(header_text_color is null or header_text_color ~ '^#[0-9a-fA-F]{6}$'),
  add constraint stores_banner_text_color_valid check(banner_text_color is null or banner_text_color ~ '^#[0-9a-fA-F]{6}$');
