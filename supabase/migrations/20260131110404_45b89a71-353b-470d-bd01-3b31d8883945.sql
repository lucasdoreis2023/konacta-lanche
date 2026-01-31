-- Tabela para armazenar mensagens pendentes (para agrupamento)
CREATE TABLE public.pending_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number TEXT NOT NULL,
  message_content TEXT NOT NULL,
  message_id TEXT NOT NULL,
  input_type TEXT NOT NULL DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por telefone
CREATE INDEX idx_pending_messages_phone ON public.pending_messages(phone_number);

-- Índice para limpeza de mensagens antigas
CREATE INDEX idx_pending_messages_created ON public.pending_messages(created_at);

-- Habilita RLS
ALTER TABLE public.pending_messages ENABLE ROW LEVEL SECURITY;

-- Policy para Edge Functions (service role)
CREATE POLICY "Service role can manage pending messages"
ON public.pending_messages
FOR ALL
USING (true)
WITH CHECK (true);

-- Adiciona campo para resumo da conversa na tabela de sessões
ALTER TABLE public.conversation_sessions 
ADD COLUMN IF NOT EXISTS conversation_summary TEXT,
ADD COLUMN IF NOT EXISTS last_summary_at TIMESTAMP WITH TIME ZONE;