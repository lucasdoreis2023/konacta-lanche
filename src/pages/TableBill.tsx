import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ArrowLeft, UtensilsCrossed, DollarSign } from 'lucide-react';
import { OrderWithItems } from '@/hooks/useOrders';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export default function TableBill() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const navigate = useNavigate();
  const num = parseInt(tableNumber || '0');

  const { data: orders, isLoading } = useQuery({
    queryKey: ['table-bill', num],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('table_number', num)
        .eq('order_type', 'PRESENCIAL')
        .in('status', ['RECEBIDO', 'EM_PREPARO', 'PRONTO'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data as OrderWithItems[];
    },
    refetchInterval: 5000,
  });

  const totalGeral = orders?.reduce((sum, o) => sum + o.total, 0) ?? 0;
  const totalItems = orders?.reduce(
    (sum, o) => sum + o.order_items.reduce((s, i) => s + i.quantity, 0),
    0
  ) ?? 0;

  const statusLabel = (status: string) => {
    switch (status) {
      case 'RECEBIDO': return 'Recebido';
      case 'EM_PREPARO': return 'Preparando';
      case 'PRONTO': return 'Pronto';
      default: return status;
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'RECEBIDO': return 'default' as const;
      case 'EM_PREPARO': return 'secondary' as const;
      case 'PRONTO': return 'outline' as const;
      default: return 'default' as const;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <Button variant="ghost" onClick={() => navigate(`/?mesa=${num}`)} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Cardápio
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conta da Mesa {num}</h1>
            <p className="text-sm text-muted-foreground">
              {orders?.length ?? 0} {(orders?.length ?? 0) === 1 ? 'pedido' : 'pedidos'} • {totalItems} itens
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !orders || orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold mb-1">Nenhum pedido</h2>
              <p className="text-muted-foreground text-sm">
                Ainda não há pedidos nesta mesa.
              </p>
              <Button className="mt-4" onClick={() => navigate(`/?mesa=${num}`)}>
                Fazer um pedido
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order, idx) => (
              <Card key={order.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      Pedido #{order.order_number}
                    </CardTitle>
                    <Badge variant={statusVariant(order.status)} className="text-xs">
                      {statusLabel(order.status)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.order_items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.product_name}</span>
                      <span className="text-muted-foreground">{formatPrice(item.total_price)}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="text-xs text-muted-foreground italic">Obs: {order.notes}</p>
                  )}
                  <div className="flex justify-end pt-1 border-t">
                    <span className="text-sm font-semibold">{formatPrice(order.total)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Total geral */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Total da Mesa
                  </span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(totalGeral)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Solicite o fechamento da conta ao atendente
                </p>
              </CardContent>
            </Card>

            <Button
              className="w-full brand-gradient border-0 text-white font-bold"
              size="lg"
              onClick={() => navigate(`/?mesa=${num}`)}
            >
              Fazer mais um pedido
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
