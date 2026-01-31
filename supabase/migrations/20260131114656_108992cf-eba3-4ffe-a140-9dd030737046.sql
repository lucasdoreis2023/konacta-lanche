-- Criar tabela store_settings para configurações da loja
CREATE TABLE public.store_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Política para leitura pública (configurações são públicas)
CREATE POLICY "Public can read store settings"
ON public.store_settings
FOR SELECT
USING (true);

-- Política para admins gerenciarem configurações
CREATE POLICY "Admins can manage store settings"
ON public.store_settings
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Inserir dados iniciais
INSERT INTO public.store_settings (key, value) VALUES 
  ('store_info', '{"name": "Minha Lanchonete", "phone": "", "address": "", "description": ""}'::jsonb),
  ('delivery', '{"fee": 5, "min_order": 20, "enabled": true}'::jsonb),
  ('hours', '{"monday": {"open": "08:00", "close": "22:00", "enabled": true}, "tuesday": {"open": "08:00", "close": "22:00", "enabled": true}, "wednesday": {"open": "08:00", "close": "22:00", "enabled": true}, "thursday": {"open": "08:00", "close": "22:00", "enabled": true}, "friday": {"open": "08:00", "close": "22:00", "enabled": true}, "saturday": {"open": "08:00", "close": "22:00", "enabled": true}, "sunday": {"open": "08:00", "close": "18:00", "enabled": false}}'::jsonb);