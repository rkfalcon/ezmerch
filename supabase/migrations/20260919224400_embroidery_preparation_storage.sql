-- Server-only queue state and unapproved derivative artwork. No user policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('embroidery-preparations', 'embroidery-preparations', false, 20971520,
  array['application/json','image/png'])
on conflict (id) do nothing;
