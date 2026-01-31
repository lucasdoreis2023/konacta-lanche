import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus } from 'lucide-react';
import { Product } from '@/types/database';
import { useCart } from '@/contexts/CartContext';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { items, addItem, updateQuantity, removeItem } = useCart();
  const cartItem = items.find(item => item.product.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      {product.image_url && (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}
      <CardContent className="p-4">
        <h3 className="font-semibold text-foreground">{product.name}</h3>
        {product.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {product.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {formatPrice(product.price)}
          </span>
          {quantity === 0 ? (
            <Button
              size="sm"
              onClick={() => addItem(product)}
              className="gap-1"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => updateQuantity(product.id, quantity - 1)}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-medium">{quantity}</span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => addItem(product)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
