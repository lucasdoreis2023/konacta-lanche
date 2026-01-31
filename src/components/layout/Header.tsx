import { Link } from 'react-router-dom';
import { CartSheet } from '@/components/cart/CartSheet';
import { UtensilsCrossed, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 brand-gradient shadow-lg">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm transition-transform group-hover:scale-110">
            <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-white tracking-wide">
            Lanchonete
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-6">
          <Link 
            to="/" 
            className="text-white/90 hover:text-white font-medium transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-white after:transition-all hover:after:w-full"
          >
            Cardápio
          </Link>
          <Link 
            to="/admin" 
            className="text-white/90 hover:text-white font-medium transition-colors relative after:absolute after:bottom-0 after:left-0 after:w-0 after:h-0.5 after:bg-white after:transition-all hover:after:w-full"
          >
            Admin
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <CartSheet />
          
          {/* Mobile Menu Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden text-white hover:bg-white/20"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <nav className={cn(
        "md:hidden overflow-hidden transition-all duration-300 bg-white/10 backdrop-blur-sm",
        menuOpen ? "max-h-40 py-4" : "max-h-0"
      )}>
        <div className="container mx-auto px-4 flex flex-col gap-3">
          <Link 
            to="/" 
            className="text-white font-medium py-2 px-4 rounded-lg hover:bg-white/20 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Cardápio
          </Link>
          <Link 
            to="/admin" 
            className="text-white font-medium py-2 px-4 rounded-lg hover:bg-white/20 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            Admin
          </Link>
        </div>
      </nav>
    </header>
  );
}
