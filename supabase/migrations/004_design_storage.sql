-- Create storage bucket for design files
INSERT INTO storage.buckets (id, name, public)
VALUES ('designs', 'designs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload designs
CREATE POLICY "Authenticated users can upload designs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'designs');

-- Allow public read access to designs (needed for Printful mockup API)
CREATE POLICY "Public can read designs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'designs');
