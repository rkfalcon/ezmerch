-- Separate from generation state so review rendering cannot publish variants or
-- race the worker's JSON patches. Cache is bound to the exact generation/artwork.
alter table public.product_generation_jobs add column if not exists review_mockup jsonb not null default '{}';
