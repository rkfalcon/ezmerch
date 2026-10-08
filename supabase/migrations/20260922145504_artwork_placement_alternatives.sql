alter table public.product_templates add column if not exists allow_front_fallback boolean not null default false;
