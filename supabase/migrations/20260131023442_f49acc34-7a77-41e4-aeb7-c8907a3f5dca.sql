-- Corrigir search_path na função update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Remover políticas permissivas e criar mais restritivas
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Permitir inserção anônima mas com validação mínima
CREATE POLICY "Public can create orders" ON public.orders 
  FOR INSERT TO anon, authenticated 
  WITH CHECK (channel IS NOT NULL AND order_type IS NOT NULL);

CREATE POLICY "Public can create order items" ON public.order_items 
  FOR INSERT TO anon, authenticated 
  WITH CHECK (order_id IS NOT NULL AND product_name IS NOT NULL);