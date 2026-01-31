import { Category } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CategoryTabsProps {
  categories: Category[] | undefined;
  isLoading: boolean;
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

export function CategoryTabs({
  categories,
  isLoading,
  selectedCategory,
  onSelectCategory,
}: CategoryTabsProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-12 w-28 rounded-full flex-shrink-0" />
        ))}
      </div>
    );
  }

  const allCategories = [
    { id: 'all', name: 'Todos' },
    ...(categories || []),
  ];

  return (
    <div className="relative">
      {/* Gradient fade on edges */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      
      <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-2 scrollbar-hide scroll-smooth">
        {allCategories.map((category, index) => {
          const isActive = selectedCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                "flex-shrink-0 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-300 category-pill",
                "shadow-sm hover:shadow-md",
                isActive
                  ? "brand-gradient text-white shadow-lg scale-105"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border hover:border-primary/30"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
              }}
            >
              {category.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
