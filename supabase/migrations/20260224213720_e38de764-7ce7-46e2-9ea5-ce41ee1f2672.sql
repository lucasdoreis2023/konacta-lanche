
-- Drop overly permissive policy
DROP POLICY "Public can activate tables" ON public.tables;

-- Create a more restrictive policy: public can only update occupied_since
CREATE POLICY "Public can activate tables"
  ON public.tables FOR UPDATE
  USING (active = true)
  WITH CHECK (active = true AND occupied_since IS NOT NULL);
