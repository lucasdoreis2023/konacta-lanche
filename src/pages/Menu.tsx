import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { HeroCarousel } from '@/components/home/HeroCarousel';
import { PromoBanners } from '@/components/home/PromoBanners';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { ProductGrid } from '@/components/menu/ProductGrid';
import { WhatsAppFloatingButton } from '@/components/WhatsAppFloatingButton';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { UtensilsCrossed } from 'lucide-react';

export default function Menu() {
  const [searchParams] = useSearchParams();
  const mesaParam = searchParams.get('mesa');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: products, isLoading: productsLoading } = useProducts();

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    if (selectedCategory === 'all') return products;
    return products.filter(p => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Carousel */}
      <HeroCarousel />

      <main className="container mx-auto px-4 py-6">
        {mesaParam && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <UtensilsCrossed className="h-5 w-5 text-primary" />
            <span className="font-medium text-primary">
              Mesa {mesaParam}
            </span>
            <span className="text-sm text-muted-foreground">
              — seus pedidos serão enviados para esta mesa
            </span>
          </div>
        )}

        {/* Promo Banners */}
        <PromoBanners />

        {/* Featured Products */}
        {products && products.length > 0 && (
          <FeaturedProducts products={products} />
        )}

        {/* Cardápio Section */}
        <section className="py-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-foreground mb-1">Cardápio Completo</h2>
            <p className="text-muted-foreground">
              Escolha seus itens favoritos e monte seu pedido
            </p>
          </div>

          {/* Category Pills */}
          <div className="bg-card rounded-2xl shadow-lg p-4 mb-6">
            <CategoryTabs
              categories={categories}
              isLoading={categoriesLoading}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          {/* Products Grid */}
          <ProductGrid products={filteredProducts} isLoading={productsLoading} />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">
            © 2024 Lanchonete. Todos os direitos reservados.
          </p>
        </div>
      </footer>

      {/* WhatsApp Floating Button */}
      <WhatsAppFloatingButton />
    </div>
  );
}
