import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ArrowLeft } from 'lucide-react';

export default function OrderSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const orderNumber = location.state?.orderNumber;

  if (!orderNumber) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-6">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-500" />
          <h1 className="mb-2 text-2xl font-bold">Pedido Confirmado!</h1>
          <p className="mb-4 text-4xl font-bold text-primary">#{orderNumber}</p>
          <p className="mb-6 text-muted-foreground">
            Seu pedido foi recebido e está sendo preparado. Acompanhe o status pelo número acima.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Cardápio
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
