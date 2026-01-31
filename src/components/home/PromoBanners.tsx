import { Tag, Clock, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Promo {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  bgClass: string;
}

const defaultPromos: Promo[] = [
  {
    id: '1',
    icon: <Tag className="h-6 w-6" />,
    title: '10% OFF no PIX',
    description: 'Pague com PIX e ganhe desconto',
    bgClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  },
  {
    id: '2',
    icon: <Truck className="h-6 w-6" />,
    title: 'Frete Grátis',
    description: 'Pedidos acima de R$ 50',
    bgClass: 'bg-blue-500/10 text-blue-600 border-blue-200',
  },
  {
    id: '3',
    icon: <Clock className="h-6 w-6" />,
    title: 'Entrega Rápida',
    description: 'Até 40 min na sua casa',
    bgClass: 'bg-amber-500/10 text-amber-600 border-amber-200',
  },
];

interface PromoBannersProps {
  promos?: Promo[];
}

export function PromoBanners({ promos = defaultPromos }: PromoBannersProps) {
  return (
    <section className="py-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {promos.map((promo) => (
          <div
            key={promo.id}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 hover:scale-[1.02] cursor-pointer",
              promo.bgClass
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-current/10">
              {promo.icon}
            </div>
            <div>
              <h3 className="font-bold">{promo.title}</h3>
              <p className="text-sm opacity-80">{promo.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
