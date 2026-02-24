import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useOrders, OrderWithItems } from '@/hooks/useOrders';
import { useKDSNotifications } from '@/hooks/useKDSNotifications';
import { OrderCardKDS } from '@/components/kds/OrderCardKDS';
import { KDSNotificationSettings } from '@/components/kds/KDSNotificationSettings';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/ui/back-button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Store, RefreshCw, ChefHat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OrderStatus } from '@/types/database';
import { cn } from '@/lib/utils';

// Play a ready sound for counter
function playReadySound(volume: number) {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.value = volume;
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
    osc.onended = () => { osc.disconnect(); gain.disconnect(); audioCtx.close(); };
  } catch { /* noop */ }
}

export default function KDSCounter() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const prevReadyIdsRef = useRef<Set<string>>(new Set());
  const initialRef = useRef(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      setIsAdmin(data === true);
    })();
  }, []);

  const activeStatuses: OrderStatus[] = ['RECEBIDO', 'EM_PREPARO', 'PRONTO'];
  const { data: orders, isLoading, refetch } = useOrders(activeStatuses);

  // Filter orders that have COUNTER items
  const counterOrders = orders?.filter(o =>
    o.order_items.some(i => (i as any).sector === 'COUNTER')
  ).map(o => ({
    ...o,
    // Show only COUNTER items but flag if it has kitchen items
    _hasKitchenItems: o.order_items.some(i => (i as any).sector === 'KITCHEN'),
    order_items: o.order_items.filter(i => (i as any).sector === 'COUNTER'),
  }));

  const { prefs, setPrefs, isFlashing, testSound } = useKDSNotifications(counterOrders);

  // Sound when order becomes READY (from kitchen)
  useEffect(() => {
    if (!orders) return;
    const readyIds = new Set(orders.filter(o => o.status === 'PRONTO').map(o => o.id));
    if (initialRef.current) { prevReadyIdsRef.current = readyIds; initialRef.current = false; return; }
    const newReady = [...readyIds].filter(id => !prevReadyIdsRef.current.has(id));
    if (newReady.length > 0 && prefs.soundEnabled) {
      playReadySound(prefs.soundVolume);
    }
    prevReadyIdsRef.current = readyIds;
  }, [orders, prefs.soundEnabled, prefs.soundVolume]);

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  if (isAdmin === false) return <Navigate to="/admin/login" replace />;

  return (
    <div className={cn('min-h-screen bg-muted/50 transition-colors duration-300', isFlashing && 'bg-blue-100 dark:bg-blue-900/30')}>
      {isFlashing && <div className="fixed inset-0 z-40 pointer-events-none animate-pulse bg-blue-500/20" />}
      <header className="sticky top-0 z-50 border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <BackButton to="/admin" />
            <Store className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Balcão</span>
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
        ) : !counterOrders?.length ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">Nenhum pedido no balcão</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {counterOrders.map(order => (
              <div key={order.id} className="relative">
                {(order as any)._hasKitchenItems && order.status !== 'PRONTO' && (
                  <Badge variant="outline" className="absolute -top-2 right-2 z-10 bg-background text-xs gap-1">
                    <ChefHat className="h-3 w-3" />
                    Aguardando cozinha
                  </Badge>
                )}
                <OrderCardKDS order={order} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
