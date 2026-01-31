import { useState, useRef, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Position {
  x: number;
  y: number;
}

export function WhatsAppFloatingButton() {
  const [position, setPosition] = useState<Position>({ x: 24, y: 24 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLAnchorElement>(null);

  const whatsappNumber = '5511999999999'; // Número da lanchonete
  const whatsappMessage = encodeURIComponent('Olá! Gostaria de fazer um pedido.');
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    e.preventDefault();
    
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!buttonRef.current) return;
    
    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    setIsDragging(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = window.innerWidth - e.clientX - (60 - dragOffset.x);
      const newY = window.innerHeight - e.clientY - (60 - dragOffset.y);
      
      setPosition({
        x: Math.max(16, Math.min(newX, window.innerWidth - 76)),
        y: Math.max(16, Math.min(newY, window.innerHeight - 76)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      
      const touch = e.touches[0];
      const newX = window.innerWidth - touch.clientX - (60 - dragOffset.x);
      const newY = window.innerHeight - touch.clientY - (60 - dragOffset.y);
      
      setPosition({
        x: Math.max(16, Math.min(newX, window.innerWidth - 76)),
        y: Math.max(16, Math.min(newY, window.innerHeight - 76)),
      });
    };

    const handleEnd = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleEnd);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragOffset]);

  const handleClick = (e: React.MouseEvent) => {
    // Prevenir clique se estava arrastando
    if (isDragging) {
      e.preventDefault();
    }
  };

  return (
    <a
      ref={buttonRef}
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className={cn(
        "fixed z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all",
        "bg-[#25D366] hover:bg-[#128C7E] text-white",
        "hover:scale-110 active:scale-95",
        isDragging ? "cursor-grabbing scale-110 shadow-2xl" : "cursor-grab",
        "select-none touch-none"
      )}
      style={{
        right: position.x,
        bottom: position.y,
      }}
      title="Fale conosco pelo WhatsApp"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" />
      
      {/* Pulse animation */}
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-30" />
    </a>
  );
}
