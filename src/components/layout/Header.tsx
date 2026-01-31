import { Link } from 'react-router-dom';
import { CartSheet } from '@/components/cart/CartSheet';
import { UtensilsCrossed } from 'lucide-react';

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <UtensilsCrossed className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">Lanchonete</span>
        </Link>
        <CartSheet />
      </div>
    </header>
  );
}
