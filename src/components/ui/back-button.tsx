import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  to?: string;
  className?: string;
}

export function BackButton({ to, className }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleClick}
      className={className}
      aria-label="Voltar"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
