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
  const [hasMoved, setHasMoved] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const startPosRef = useRef<Position>({ x: 0, y: 0 });

  const whatsappNumber = '5511999999999'; // Número da lanchonete
  const whatsappMessage = encodeURIComponent('Olá! Gostaria de fazer um pedido.');

  const openWhatsApp = () => {
    if (hasMoved) {
      setHasMoved(false);
      return;
    }
    
    // Detecta se é mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Link direto para o app do WhatsApp no mobile
      window.location.href = `whatsapp://send?phone=${whatsappNumber}&text=${whatsappMessage}`;
    } else {
      // Web WhatsApp para desktop
      window.open(`https://web.whatsapp.com/send?phone=${whatsappNumber}&text=${whatsappMessage}`, '_blank');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!buttonRef.current) return;
    e.preventDefault();
    
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    startPosRef.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
    setHasMoved(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!buttonRef.current) return;
    
    const touch = e.touches[0];
    const rect = buttonRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    });
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    setIsDragging(true);
    setHasMoved(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      // Check if actually moved
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > 5 || dy > 5) {
        setHasMoved(true);
      }
      
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
      
      // Check if actually moved
      const dx = Math.abs(touch.clientX - startPosRef.current.x);
      const dy = Math.abs(touch.clientY - startPosRef.current.y);
      if (dx > 5 || dy > 5) {
        setHasMoved(true);
      }
      
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

  return (
    <button
      ref={buttonRef}
      onClick={openWhatsApp}
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
    </button>
  );
}
