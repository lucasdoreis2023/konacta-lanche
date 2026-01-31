import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { ProductGrid } from '@/components/menu/ProductGrid';
import { WhatsAppFloatingButton } from '@/components/WhatsAppFloatingButton';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import { Sparkles } from 'lucide-react';

export default function Menu() {
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
      
      {/* Hero Section */}
      <section className="hero-section text-white py-12 px-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-2 mb-3 animate-fade-in">
            <Sparkles className="h-5 w-5 text-secondary" />
            <span className="text-white/80 text-sm font-medium uppercase tracking-wider">
              Sabor que conquista
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 animate-slide-up">
            Nosso Cardápio
          </h1>
          <p className="text-white/80 text-lg max-w-md animate-fade-in" style={{ animationDelay: '100ms' }}>
            Escolha seus itens favoritos e monte seu pedido perfeito
          </p>
        </div>
      </section>

      <main className="container mx-auto px-4 py-6 -mt-4">
        {/* Category Pills */}
        <div className="bg-card rounded-2xl shadow-lg p-4 mb-6 animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CategoryTabs
            categories={categories}
            isLoading={categoriesLoading}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        {/* Products */}
        <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <ProductGrid products={filteredProducts} isLoading={productsLoading} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card border-t mt-12 py-8">
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
