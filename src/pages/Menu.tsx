import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/Header';
import { CategoryTabs } from '@/components/menu/CategoryTabs';
import { ProductGrid } from '@/components/menu/ProductGrid';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';

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
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="mb-2 text-3xl font-bold text-foreground">Cardápio</h1>
          <p className="text-muted-foreground">
            Escolha seus itens favoritos e monte seu pedido
          </p>
        </div>

        <div className="mb-6">
          <CategoryTabs
            categories={categories}
            isLoading={categoriesLoading}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>

        <ProductGrid products={filteredProducts} isLoading={productsLoading} />
      </main>
    </div>
  );
}
