import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Trash2, Plus, Minus, ShoppingBag } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';

export function CartSheet() {
  const { items, itemCount, total, updateQuantity, removeItem, clearCart } = useCart();
  const navigate = useNavigate();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <Sheet>
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
              <span className="block">Seu Pedido</span>
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
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
