import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Order, OrderItem, OrderStatus } from '@/types/database';

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
}

export function useOrders(statuses?: OrderStatus[]) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['orders', statuses],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });
      
      if (statuses && statuses.length > 0) {
        q = q.in('status', statuses);
      }
      
      const { data, error } = await q;
      
      if (error) throw error;
      return data as OrderWithItems[];
    },
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['orders'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}
