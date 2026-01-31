-- Adiciona coluna para armazenar o tipo de input do cliente (audio ou text)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS input_type text DEFAULT 'text';

-- Comentário para documentação
COMMENT ON COLUMN public.orders.input_type IS 'Tipo de input usado pelo cliente: audio ou text. Usado para responder no mesmo formato.';