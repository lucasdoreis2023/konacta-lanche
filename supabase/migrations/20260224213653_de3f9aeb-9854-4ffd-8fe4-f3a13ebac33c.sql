
ALTER TABLE public.tables ADD COLUMN occupied_since timestamp with time zone DEFAULT NULL;

-- Allow public to update occupied_since when activating a table
CREATE POLICY "Public can activate tables"
  ON public.tables FOR UPDATE
  USING (active = true)
  WITH CHECK (active = true);
