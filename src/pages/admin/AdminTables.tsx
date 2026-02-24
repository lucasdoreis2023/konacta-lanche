import { useMemo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useOrders, OrderWithItems } from '@/hooks/useOrders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Receipt, Users, DollarSign, CheckCircle2 } from 'lucide-react';
import { OrderStatus } from '@/types/database';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TableData {
  tableNumber: number;
  orders: OrderWithItems[];
  totalAmount: number;
  oldestOrder: string;
  itemCount: number;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

export default function AdminTables() {
  const { data: orders, isLoading } = useOrders(['RECEBIDO', 'EM_PREPARO', 'PRONTO']);
  const queryClient = useQueryClient();

  const activeTables = useMemo(() => {
    if (!orders) return [];

    const tableMap = new Map<number, OrderWithItems[]>();

    orders
      .filter(o => o.order_type === 'PRESENCIAL' && o.table_number)
      .forEach(order => {
        const num = order.table_number!;
        if (!tableMap.has(num)) tableMap.set(num, []);
        tableMap.get(num)!.push(order);
      });

    const tables: TableData[] = [];
    tableMap.forEach((tableOrders, tableNumber) => {
      const totalAmount = tableOrders.reduce((sum, o) => sum + o.total, 0);
      const itemCount = tableOrders.reduce(
        (sum, o) => sum + o.order_items.reduce((s, i) => s + i.quantity, 0),
        0
      );
      const oldestOrder = tableOrders.reduce(
        (oldest, o) => (o.created_at < oldest ? o.created_at : oldest),
        tableOrders[0].created_at
      );
      tables.push({ tableNumber, orders: tableOrders, totalAmount, oldestOrder, itemCount });
    });

    return tables.sort((a, b) => a.tableNumber - b.tableNumber);
  }, [orders]);

  const handleCloseTable = async (table: TableData) => {
    try {
      const ids = table.orders.map(o => o.id);
      const { error } = await supabase
        .from('orders')
        .update({ status: 'ENTREGUE' as OrderStatus })
        .in('id', ids);

      if (error) throw error;

      toast.success(`Mesa ${table.tableNumber} fechada — ${formatPrice(table.totalAmount)}`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error) {
      console.error('Erro ao fechar mesa:', error);
      toast.error('Erro ao fechar mesa');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mesas</h1>
            <p className="text-muted-foreground">
              Acompanhe as mesas ativas e feche a conta
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-1">
            {activeTables.length} {activeTables.length === 1 ? 'mesa ativa' : 'mesas ativas'}
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : activeTables.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-1">Nenhuma mesa ativa</h2>
              <p className="text-muted-foreground">
                Quando clientes fizerem pedidos presenciais com número de mesa, eles aparecerão aqui.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {activeTables.map(table => (
              <Card key={table.tableNumber} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-2xl">Mesa {table.tableNumber}</CardTitle>
                    <Badge variant="outline" className="gap-1">
                      <Receipt className="h-3 w-3" />
                      {table.orders.length} {table.orders.length === 1 ? 'pedido' : 'pedidos'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aberta{' '}
                    {formatDistanceToNow(new Date(table.oldestOrder), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </CardHeader>

                <CardContent className="flex flex-1 flex-col gap-4">
                  {/* Items list */}
                  <div className="flex-1 space-y-3 max-h-64 overflow-y-auto">
                    {table.orders.map(order => (
                      <div key={order.id} className="rounded-md border p-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Pedido #{order.order_number}</span>
                          <Badge
                            variant={
                              order.status === 'RECEBIDO'
                                ? 'default'
                                : order.status === 'EM_PREPARO'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px]"
                          >
                            {order.status === 'RECEBIDO'
                              ? 'Recebido'
                              : order.status === 'EM_PREPARO'
                              ? 'Preparando'
                              : 'Pronto'}
                          </Badge>
                        </div>
                        {order.order_items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>
                              {item.quantity}x {item.product_name}
                            </span>
                            <span className="text-muted-foreground">{formatPrice(item.total_price)}</span>
                          </div>
                        ))}
                        {order.notes && (
                          <p className="text-xs text-muted-foreground italic">Obs: {order.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{table.itemCount} itens</span>
                      <span>{table.orders.length} pedidos</span>
                    </div>
                    <div className="flex items-center justify-between text-lg font-bold">
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Total
                      </span>
                      <span>{formatPrice(table.totalAmount)}</span>
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    onClick={() => handleCloseTable(table)}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Fechar Mesa — {formatPrice(table.totalAmount)}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
