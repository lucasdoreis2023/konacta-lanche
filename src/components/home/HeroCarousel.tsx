import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  bgColor: string;
  textColor?: string;
}

const defaultBanners: Banner[] = [
  {
    id: '1',
    title: 'Combo Família',
    subtitle: '2 X-Burger + Batata Grande + 2 Refri por apenas R$ 65,90',
    bgColor: 'from-primary to-secondary',
  },
  {
    id: '2',
    title: 'Terça do Bacon',
    subtitle: 'Toda terça X-Bacon com 20% de desconto!',
    bgColor: 'from-amber-500 to-orange-600',
  },
  {
    id: '3',
    title: 'Delivery Grátis',
    subtitle: 'Pedidos acima de R$ 50 ganham entrega grátis',
    bgColor: 'from-emerald-500 to-teal-600',
  },
];

interface HeroCarouselProps {
  banners?: Banner[];
}

export function HeroCarousel({ banners = defaultBanners }: HeroCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [banners.length, isAutoPlaying]);

  const goTo = (index: number) => {
    setCurrent(index);
    setIsAutoPlaying(false);
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const prev = () => goTo((current - 1 + banners.length) % banners.length);
  const next = () => goTo((current + 1) % banners.length);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Slides */}
      <div 
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {banners.map((banner) => (
          <div
            key={banner.id}
            className={cn(
              "w-full flex-shrink-0 bg-gradient-to-r py-16 px-6 md:py-24",
              banner.bgColor
            )}
          >
            <div className="container mx-auto text-center text-white">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 animate-fade-in">
                {banner.title}
              </h2>
              <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
                {banner.subtitle}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Navigation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full h-10 w-10"
        onClick={prev}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/20 hover:bg-black/40 text-white rounded-full h-10 w-10"
        onClick={next}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {banners.map((_, index) => (
          <button
            key={index}
            onClick={() => goTo(index)}
            className={cn(
              "w-3 h-3 rounded-full transition-all",
              index === current 
                ? "bg-white w-8" 
                : "bg-white/50 hover:bg-white/70"
            )}
          />
        ))}
      </div>
    </div>
  );
}
