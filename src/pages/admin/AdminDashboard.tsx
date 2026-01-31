import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  FolderTree, 
  ClipboardList, 
  DollarSign,
  TrendingUp,
  ArrowUpRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  RECEBIDO: { label: 'Recebido', variant: 'default' },
  EM_PREPARO: { label: 'Em Preparo', variant: 'secondary' },
  PRONTO: { label: 'Pronto', variant: 'outline' },
  ENTREGUE: { label: 'Entregue', variant: 'default' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
};

export default function AdminDashboard() {
  const { data: orders } = useOrders();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();

  const todayOrders = orders?.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  }) || [];

  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const pendingOrders = orders?.filter(o => 
    o.status === 'RECEBIDO' || o.status === 'EM_PREPARO'
  ).length || 0;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const stats = [
    {
      title: 'Pedidos Hoje',
      value: todayOrders.length,
      icon: ClipboardList,
      color: 'bg-blue-500/10 text-blue-600',
      iconColor: 'text-blue-500',
    },
    {
      title: 'Faturamento Hoje',
      value: formatPrice(todayRevenue),
      icon: DollarSign,
      color: 'bg-green-500/10 text-green-600',
      iconColor: 'text-green-500',
    },
    {
      title: 'Pedidos Pendentes',
      value: pendingOrders,
      icon: TrendingUp,
      color: 'bg-orange-500/10 text-orange-600',
      iconColor: 'text-orange-500',
    },
    {
      title: 'Produtos Ativos',
      value: products?.filter(p => p.active).length || 0,
      icon: Package,
      color: 'bg-purple-500/10 text-purple-600',
      iconColor: 'text-purple-500',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo ao painel administrativo
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="relative overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <div className={`rounded-lg p-2 ${stat.color}`}>
                    <Icon className={`h-4 w-4`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Pedidos Recentes</CardTitle>
              <Link 
                to="/admin/orders" 
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Ver todos
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orders?.slice(0, 5).map(order => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">#{order.order_number}</span>
                        <Badge variant={statusConfig[order.status]?.variant || 'default'}>
                          {statusConfig[order.status]?.label || order.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_name || 'Cliente'} •{' '}
                        {format(new Date(order.created_at), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="font-semibold text-green-600">
                      {formatPrice(order.total)}
                    </span>
                  </div>
                )) || (
                  <p className="py-8 text-center text-muted-foreground">
                    Nenhum pedido ainda
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <FolderTree className="h-4 w-4 text-blue-500" />
                    </div>
                    <span>Categorias</span>
                  </div>
                  <span className="font-semibold">{categories?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-purple-500/10 p-2">
                      <Package className="h-4 w-4 text-purple-500" />
                    </div>
                    <span>Produtos</span>
                  </div>
                  <span className="font-semibold">{products?.length || 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-500/10 p-2">
                      <ClipboardList className="h-4 w-4 text-green-500" />
                    </div>
                    <span>Total de Pedidos</span>
                  </div>
                  <span className="font-semibold">{orders?.length || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
