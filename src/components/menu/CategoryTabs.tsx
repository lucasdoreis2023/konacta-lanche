import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Category } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';

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
      <div className="flex gap-2 overflow-x-auto pb-2">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-10 w-24 rounded-full" />
        ))}
      </div>
    );
  }

  return (
    <Tabs value={selectedCategory} onValueChange={onSelectCategory}>
      <TabsList className="h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
        <TabsTrigger
          value="all"
          className="rounded-full border border-border px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          Todos
        </TabsTrigger>
        {categories?.map(category => (
          <TabsTrigger
            key={category.id}
            value={category.id}
            className="rounded-full border border-border px-4 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            {category.name}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
