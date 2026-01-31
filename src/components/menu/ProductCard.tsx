import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, ShoppingBag } from 'lucide-react';
import { Product } from '@/types/database';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find(item => item.product.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group",
      "border-0 shadow-md"
    )}>
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-muted to-muted/50">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ShoppingBag className="h-16 w-16 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Badge de preço */}
        <div className="absolute bottom-3 left-3 brand-gradient rounded-full px-4 py-1.5 shadow-lg">
          <span className="text-sm font-bold text-white">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Indicador de quantidade no carrinho */}
        {quantity > 0 && (
          <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-white text-sm font-bold shadow-lg animate-scale-in">
            {quantity}
          </div>
        )}
      </div>

      <CardContent className="p-4">
        <h3 className="font-bold text-lg text-foreground line-clamp-1 mb-1">
          {product.name}
        </h3>
        
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
            {product.description}
          </p>
        )}

        {quantity === 0 ? (
          <Button
            onClick={() => addItem(product)}
            className="w-full gap-2 brand-gradient border-0 text-white font-semibold shadow-md hover:shadow-lg transition-all hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        ) : (
          <div className="flex items-center justify-between gap-2 bg-muted rounded-lg p-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 rounded-lg hover:bg-primary/10 hover:text-primary"
              onClick={() => updateQuantity(product.id, quantity - 1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="text-lg font-bold text-foreground min-w-[2rem] text-center">
              {quantity}
            </span>
            <Button
              size="icon"
              className="h-10 w-10 rounded-lg brand-gradient border-0 text-white"
              onClick={() => addItem(product)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
