import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrders } from '@/hooks/useOrders';
import { useKDSNotifications } from '@/hooks/useKDSNotifications';
import { OrderCardKDS } from '@/components/kds/OrderCardKDS';
import { KDSNotificationSettings } from '@/components/kds/KDSNotificationSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { supabase } from '@/integrations/supabase/client';
import { Bell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatus } from '@/types/database';
import { cn } from '@/lib/utils';

export default function KDSReady() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(data === true);
    })();
  }, []);

  const readyStatuses: OrderStatus[] = ['PRONTO'];
  const { data: orders, isLoading, refetch } = useOrders(readyStatuses);

  const { prefs, setPrefs, isFlashing, testSound } = useKDSNotifications(orders);

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (isAdmin === false) return <Navigate to="/admin/login" replace />;

  return (
    <div className={cn('min-h-screen bg-muted/50 transition-colors duration-300', isFlashing && 'bg-green-100 dark:bg-green-900/30')}>
      {isFlashing && <div className="fixed inset-0 z-40 pointer-events-none animate-pulse bg-green-500/20" />}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BackButton to="/admin" />
            <Bell className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Prontos</span>
          </div>
          <div className="flex items-center gap-4">
            <KDSNotificationSettings prefs={prefs} setPrefs={setPrefs} testSound={testSound} />
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : !orders?.length ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum pedido pronto no momento</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders.map(order => (
              <OrderCardKDS key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
