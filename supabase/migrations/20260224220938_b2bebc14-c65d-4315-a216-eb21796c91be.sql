
-- Create enum for item sector
CREATE TYPE public.item_sector AS ENUM ('KITCHEN', 'COUNTER');

-- Add sector to products (default KITCHEN for existing)
ALTER TABLE public.products ADD COLUMN sector item_sector NOT NULL DEFAULT 'KITCHEN';

-- Add sector to order_items (default KITCHEN for existing)
ALTER TABLE public.order_items ADD COLUMN sector item_sector NOT NULL DEFAULT 'KITCHEN';
