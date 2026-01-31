-- Enums para tipagem
CREATE TYPE public.order_channel AS ENUM ('SITE', 'WHATSAPP');
CREATE TYPE public.order_type AS ENUM ('PRESENCIAL', 'DELIVERY');
CREATE TYPE public.payment_method AS ENUM ('PIX', 'CARTAO', 'DINHEIRO');
CREATE TYPE public.order_status AS ENUM ('RECEBIDO', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabela de categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number SERIAL,
  channel order_channel NOT NULL DEFAULT 'SITE',
  order_type order_type NOT NULL DEFAULT 'PRESENCIAL',
  status order_status NOT NULL DEFAULT 'RECEBIDO',
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  payment_method payment_method,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT
);

-- Sessões de conversa WhatsApp
CREATE TABLE public.conversation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  current_state TEXT NOT NULL DEFAULT 'WELCOME',
  context_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de roles de usuário
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Função para verificar role (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_conversation_sessions_updated_at BEFORE UPDATE ON public.conversation_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas públicas de leitura (cardápio)
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (active = true);
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (active = true);

-- Políticas de pedidos (qualquer um pode criar, admins gerenciam)
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create order items" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage orders" ON public.orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage order items" ON public.order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public read order items" ON public.order_items FOR SELECT USING (true);

-- Políticas admin
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage sessions" ON public.conversation_sessions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Realtime para KDS
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Dados iniciais
INSERT INTO public.categories (name, display_order) VALUES
  ('Lanches', 1),
  ('Bebidas', 2),
  ('Porções', 3),
  ('Combos', 4),
  ('Sobremesas', 5);

INSERT INTO public.products (category_id, name, description, price) VALUES
  ((SELECT id FROM public.categories WHERE name = 'Lanches'), 'X-Burger', 'Pão, hambúrguer, queijo, alface e tomate', 18.90),
  ((SELECT id FROM public.categories WHERE name = 'Lanches'), 'X-Bacon', 'Pão, hambúrguer, queijo, bacon, alface e tomate', 22.90),
  ((SELECT id FROM public.categories WHERE name = 'Lanches'), 'X-Tudo', 'Pão, hambúrguer, queijo, bacon, ovo, presunto, alface e tomate', 28.90),
  ((SELECT id FROM public.categories WHERE name = 'Lanches'), 'Hot Dog Simples', 'Pão, salsicha, mostarda e ketchup', 12.90),
  ((SELECT id FROM public.categories WHERE name = 'Lanches'), 'Hot Dog Completo', 'Pão, salsicha, purê, batata palha, mostarda e ketchup', 16.90),
  ((SELECT id FROM public.categories WHERE name = 'Bebidas'), 'Coca-Cola Lata', 'Lata 350ml', 6.00),
  ((SELECT id FROM public.categories WHERE name = 'Bebidas'), 'Guaraná Lata', 'Lata 350ml', 5.50),
  ((SELECT id FROM public.categories WHERE name = 'Bebidas'), 'Suco Natural', 'Laranja ou Limão 300ml', 8.00),
  ((SELECT id FROM public.categories WHERE name = 'Porções'), 'Batata Frita', 'Porção 300g', 18.00),
  ((SELECT id FROM public.categories WHERE name = 'Porções'), 'Onion Rings', 'Porção 200g', 22.00),
  ((SELECT id FROM public.categories WHERE name = 'Combos'), 'Combo Lanche', 'X-Burger + Batata + Refrigerante', 35.90),
  ((SELECT id FROM public.categories WHERE name = 'Combos'), 'Combo Família', '2 X-Burger + Batata Grande + 2 Refri', 65.90),
  ((SELECT id FROM public.categories WHERE name = 'Sobremesas'), 'Milk Shake', 'Chocolate, Morango ou Baunilha 400ml', 14.90),
  ((SELECT id FROM public.categories WHERE name = 'Sobremesas'), 'Sundae', 'Sorvete com calda de chocolate', 12.00);