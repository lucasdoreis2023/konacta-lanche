export type OrderChannel = 'SITE' | 'WHATSAPP';
export type OrderType = 'PRESENCIAL' | 'DELIVERY';
export type PaymentMethod = 'PIX' | 'CARTAO' | 'DINHEIRO';
export type OrderStatus = 'RECEBIDO' | 'EM_PREPARO' | 'PRONTO' | 'ENTREGUE' | 'CANCELADO';
export type AppRole = 'admin' | 'user';

export interface Category {
  id: string;
  name: string;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type InputType = 'text' | 'audio';

export interface Order {
  id: string;
  order_number: number;
  channel: OrderChannel;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  table_number: number | null;
  payment_method: PaymentMethod | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  notes: string | null;
  input_type: string | null; // 'text' ou 'audio' - vem como string do banco
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
  notes?: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface StoreSettings {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StoreInfo {
  name: string;
  phone: string;
  address: string;
  description: string;
}

export interface DeliverySettings {
  fee: number;
  min_order: number;
  enabled: boolean;
}

export interface DayHours {
  open: string;
  close: string;
  enabled: boolean;
}

export interface StoreHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}
