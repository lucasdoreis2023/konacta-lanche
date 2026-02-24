import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag, Send, Receipt, Loader2 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function CartSheet() {
  const { items, itemCount, total, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mesaParam = searchParams.get('mesa');
  const [isSending, setIsSending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleSendTableOrder = async () => {
    if (!mesaParam || items.length === 0) return;
    setIsSending(true);
    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          channel: 'SITE' as const,
          order_type: 'PRESENCIAL' as const,
          table_number: parseInt(mesaParam),
          customer_name: `Mesa ${mesaParam}`,
          subtotal: total,
          delivery_fee: 0,
          total: total,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      clearCart();
      setIsOpen(false);
      toast.success(`Pedido #${order.order_number} enviado para a cozinha!`);
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
      toast.error('Erro ao enviar pedido. Tente novamente.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          size="icon" 
          className="relative bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
        >
          <ShoppingCart className="h-5 w-5" />
          {itemCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-xs bg-secondary border-0 animate-pulse-soft">
              {itemCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md p-0">
        <SheetHeader className="p-6 pb-4 brand-gradient text-white">
          <SheetTitle className="flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <span className="block">{mesaParam ? `Mesa ${mesaParam}` : 'Seu Pedido'}</span>
              {itemCount > 0 && (
                <span className="text-sm font-normal text-white/80">
                  {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                </span>
              )}
            </div>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <ShoppingCart className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-center">
              Seu carrinho está vazio.<br />
              Adicione itens deliciosos!
            </p>
            {mesaParam && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setIsOpen(false);
                  navigate(`/conta-mesa/${mesaParam}`);
                }}
              >
                <Receipt className="h-4 w-4" />
                Ver Conta da Mesa
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {items.map(item => (
                  <div 
                    key={item.product.id} 
                    className="flex gap-4 p-4 rounded-xl bg-muted/50 border border-border"
                  >
                    {item.product.image_url && (
                      <div className="h-16 w-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                        <img 
                          src={item.product.image_url} 
                          alt={item.product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-foreground truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-sm text-primary font-bold mt-1">
                        {formatPrice(item.product.price * item.quantity)}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 rounded-full"
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold">
                          {item.quantity}
                        </span>
                        <Button
                          size="icon"
                          className="h-7 w-7 rounded-full brand-gradient border-0 text-white"
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 ml-auto text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(item.product.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t bg-card p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total</span>
                <span className="text-2xl font-bold text-foreground">
                  {formatPrice(total)}
                </span>
              </div>

              {mesaParam ? (
                <>
                  <Button
                    className="w-full brand-gradient border-0 text-white font-bold shadow-lg hover:opacity-90 gap-2"
                    size="lg"
                    onClick={handleSendTableOrder}
                    disabled={isSending}
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isSending ? 'Enviando...' : 'Enviar Pedido'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(`/conta-mesa/${mesaParam}`);
                    }}
                  >
                    <Receipt className="h-4 w-4" />
                    Fechar Conta
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    className="w-full brand-gradient border-0 text-white font-bold shadow-lg hover:opacity-90"
                    size="lg"
                    onClick={() => navigate('/checkout')}
                  >
                    Finalizar Pedido
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full text-muted-foreground hover:text-destructive"
                    onClick={clearCart}
                  >
                    Limpar Carrinho
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
