import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { OrderCardKDS } from '@/components/kds/OrderCardKDS';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { UtensilsCrossed, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatus } from '@/types/database';

export default function KDS() {
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });
    
    setIsAdmin(data === true);
  };

  const activeStatuses: OrderStatus[] = ['RECEBIDO', 'EM_PREPARO', 'PRONTO'];
  const { data: orders, isLoading, refetch } = useOrders(
    filter === 'active' ? activeStatuses : undefined
  );

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAdmin === false) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen bg-muted/50">
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">KDS - Cozinha</span>
          </div>
          <div className="flex items-center gap-4">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as 'active' | 'all')}>
              <TabsList>
                <TabsTrigger value="active">Ativos</TabsTrigger>
                <TabsTrigger value="all">Todos</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        ) : orders?.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum pedido encontrado</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders?.map(order => (
              <OrderCardKDS key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
