import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { Package, FolderTree, ClipboardList, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const { data: orders } = useOrders();
  const { data: products } = useProducts();
  const { data: categories } = useCategories();

  const todayOrders = orders?.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  }) || [];

  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);

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
      color: 'text-blue-500',
    },
    {
      title: 'Faturamento Hoje',
      value: formatPrice(todayRevenue),
      icon: DollarSign,
      color: 'text-green-500',
    },
    {
      title: 'Produtos',
      value: products?.length || 0,
      icon: Package,
      color: 'text-purple-500',
    },
    {
      title: 'Categorias',
      value: categories?.length || 0,
      icon: FolderTree,
      color: 'text-orange-500',
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {orders?.slice(0, 5).map(order => (
              <div
                key={order.id}
                className="flex items-center justify-between border-b py-3 last:border-0"
              >
                <div>
                  <p className="font-medium">Pedido #{order.order_number}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.customer_name || 'Cliente'} • {order.status}
                  </p>
                </div>
                <span className="font-semibold">{formatPrice(order.total)}</span>
              </div>
            )) || <p className="text-muted-foreground">Nenhum pedido ainda</p>}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
