
-- Table to store tables with fixed passwords
CREATE TABLE public.tables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_number integer NOT NULL UNIQUE,
  password text NOT NULL DEFAULT lpad(floor(random() * 10000)::text, 4, '0'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Public can read table info (needed for activation check)
CREATE POLICY "Public can read tables" ON public.tables
  FOR SELECT USING (true);

-- Admins can manage tables
CREATE POLICY "Admins can manage tables" ON public.tables
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default 10 tables
INSERT INTO public.tables (table_number, password) VALUES
  (1, '1001'), (2, '1002'), (3, '1003'), (4, '1004'), (5, '1005'),
  (6, '1006'), (7, '1007'), (8, '1008'), (9, '1009'), (10, '1010');
