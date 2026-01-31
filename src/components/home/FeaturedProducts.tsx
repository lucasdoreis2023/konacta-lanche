import { Flame, Star, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Product } from '@/types/database';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

interface FeaturedProductsProps {
  products: Product[];
}

export function FeaturedProducts({ products }: FeaturedProductsProps) {
  const { addItem } = useCart();
  
  // Pegar os 3 primeiros produtos como destaque (pode ser configurável depois)
  const featuredProducts = products.slice(0, 3);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  if (featuredProducts.length === 0) return null;

  return (
    <section className="py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full brand-gradient">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-foreground">Em Destaque</h2>
          <p className="text-sm text-muted-foreground">Os mais pedidos da casa</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {featuredProducts.map((product, index) => (
          <Card 
            key={product.id}
            className={cn(
              "relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1",
              index === 0 ? "border-primary/50 md:col-span-1" : "border-transparent"
            )}
          >
            {/* Badge de destaque */}
            <div className="absolute top-3 left-3 z-10">
              {index === 0 ? (
                <Badge className="bg-primary text-white gap-1">
                  <Star className="h-3 w-3" fill="currentColor" />
                  Mais Vendido
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <Percent className="h-3 w-3" />
                  Destaque
                </Badge>
              )}
            </div>

            {/* Imagem ou placeholder */}
            <div className={cn(
              "aspect-video bg-gradient-to-br",
              index === 0 
                ? "from-primary/20 to-secondary/20" 
                : "from-muted to-muted/50"
            )}>
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <span className="text-6xl opacity-20">🍔</span>
                </div>
              )}
            </div>

            <CardContent className="p-4">
              <h3 className="font-bold text-lg mb-1">{product.name}</h3>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {product.description}
                </p>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold text-primary">
                  {formatPrice(product.price)}
                </span>
                <Button 
                  size="sm"
                  onClick={() => addItem(product)}
                  className="brand-gradient border-0 text-white"
                >
                  Adicionar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
