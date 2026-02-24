import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderWithItems } from '@/hooks/useOrders';
import { OrderStatus } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, MapPin, Phone, User, ChefHat, Check, X, MessageCircle, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrderCardKDSProps {
  order: OrderWithItems;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; next?: OrderStatus }> = {
  RECEBIDO: { label: 'Recebido', color: 'bg-blue-500', next: 'EM_PREPARO' },
  EM_PREPARO: { label: 'Em Preparo', color: 'bg-yellow-500', next: 'PRONTO' },
  PRONTO: { label: 'Pronto', color: 'bg-green-500', next: 'ENTREGUE' },
  ENTREGUE: { label: 'Entregue', color: 'bg-gray-500' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-500' },
};

const nextActionLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  EM_PREPARO: { label: 'Iniciar Preparo', icon: <ChefHat className="h-4 w-4" /> },
  PRONTO: { label: 'Marcar Pronto', icon: <Check className="h-4 w-4" /> },
  ENTREGUE: { label: 'Entregar', icon: <Check className="h-4 w-4" /> },
};

// Status que devem enviar notificação ao cliente
const notifiableStatuses: OrderStatus[] = ['EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];

// Verifica se o pedido está em revisão (baseado nas notes)
function isOrderInReview(notes: string | null): boolean {
  if (!notes) return false;
  return notes.includes('EM REVISÃO') || notes.includes('REVISÃO');
}


export function OrderCardKDS({ order }: OrderCardKDSProps) {
  const config = statusConfig[order.status];
  const nextStatus = config.next;
  const nextAction = nextStatus ? nextActionLabels[nextStatus] : null;

  // Notifica o cliente via WhatsApp sobre mudança de status
  const notifyCustomer = async (newStatus: OrderStatus) => {
    // Só notifica se tiver telefone e for do WhatsApp
    if (!order.customer_phone || order.channel !== 'WHATSAPP') {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('notify-order-status', {
        body: {
          orderId: order.id,
          orderNumber: order.order_number,
          status: newStatus,
          customerPhone: order.customer_phone,
          customerName: order.customer_name,
          orderType: order.order_type,
          total: order.total,
          inputType: order.input_type || 'text', // Envia o tipo de input para notificar no mesmo formato
        },
      });

      if (error) {
        console.error('Erro ao enviar notificação:', error);
      } else {
        toast.success(`Notificação enviada para ${order.customer_phone}`, {
          icon: <MessageCircle className="h-4 w-4" />,
        });
      }
    } catch (error) {
      console.error('Erro ao notificar cliente:', error);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (error) throw error;
      
      toast.success(`Pedido #${order.order_number} atualizado`);

      // Envia notificação WhatsApp se aplicável
      if (notifiableStatuses.includes(newStatus)) {
        await notifyCustomer(newStatus);
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar pedido');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const timeAgo = formatDistanceToNow(new Date(order.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`${isOrderInReview(order.notes) ? 'bg-orange-500' : config.color} text-white py-3`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">#{order.order_number}</CardTitle>
          <div className="flex gap-1">
            {isOrderInReview(order.notes) && (
              <Badge variant="destructive" className="text-xs bg-yellow-600">
                <AlertTriangle className="h-3 w-3 mr-1" />
                REVISÃO
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {order.channel} • {order.order_type === 'DELIVERY' ? 'Delivery' : `Mesa ${order.table_number || '-'}`}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm opacity-90">
          <Clock className="h-3 w-3" />
          {timeAgo}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {/* Customer Info */}
        <div className="mb-4 space-y-1 text-sm">
          {order.customer_name && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{order.customer_name}</span>
            </div>
          )}
          {order.customer_phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{order.customer_phone}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-[#25D366] hover:text-[#128C7E] hover:bg-[#25D366]/10"
                onClick={(e) => {
                  e.stopPropagation();
                  const phone = order.customer_phone?.replace(/\D/g, '');
                  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                  const url = isMobile 
                    ? `whatsapp://send?phone=${phone}` 
                    : `https://web.whatsapp.com/send?phone=${phone}`;
                  window.open(url, '_blank');
                }}
                title="Abrir conversa no WhatsApp"
              >
                <MessageCircle className="h-4 w-4" fill="currentColor" />
              </Button>
            </div>
          )}
          {order.delivery_address && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs">{order.delivery_address}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="mb-4 space-y-2 border-t pt-3">
          {order.order_items.map(item => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                <strong>{item.quantity}x</strong> {item.product_name}
              </span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div className="mb-4 rounded bg-muted p-2 text-sm">
            <strong>Obs:</strong> {order.notes}
          </div>
        )}

        {/* Total */}
        <div className="mb-4 flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {nextAction && nextStatus && (
            <Button
              className="flex-1"
              onClick={() => handleStatusChange(nextStatus)}
            >
              {nextAction.icon}
              <span className="ml-2">{nextAction.label}</span>
            </Button>
          )}
          {order.status !== 'CANCELADO' && order.status !== 'ENTREGUE' && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleStatusChange('CANCELADO')}
              className="text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
