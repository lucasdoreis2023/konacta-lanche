import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Order } from '@/types/database';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

interface DailySales {
  date: string;
  total: number;
  count: number;
}

interface ProductSales {
  product_name: string;
  quantity: number;
  total: number;
}

export function useOrdersStats(days: number = 7) {
  return useQuery({
    queryKey: ['orders-stats', days],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), days - 1));
      const endDate = endOfDay(new Date());

      // Get orders within date range
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .neq('status', 'CANCELADO');

      if (ordersError) throw ordersError;

      // Calculate daily sales
      const dailySalesMap = new Map<string, DailySales>();
      
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
        dailySalesMap.set(date, { date, total: 0, count: 0 });
      }

      orders?.forEach((order: Order) => {
        const date = format(new Date(order.created_at), 'yyyy-MM-dd');
        const existing = dailySalesMap.get(date);
        if (existing) {
          existing.total += Number(order.total);
          existing.count += 1;
        }
      });

      const dailySales = Array.from(dailySalesMap.values());

      // Calculate product sales
      const productSalesMap = new Map<string, ProductSales>();
      
      orders?.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          const existing = productSalesMap.get(item.product_name);
          if (existing) {
            existing.quantity += item.quantity;
            existing.total += Number(item.total_price);
          } else {
            productSalesMap.set(item.product_name, {
              product_name: item.product_name,
              quantity: item.quantity,
              total: Number(item.total_price),
            });
          }
        });
      });

      const topProducts = Array.from(productSalesMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Calculate totals
      const totalRevenue = orders?.reduce((sum, o) => sum + Number(o.total), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Orders by channel
      const byChannel = {
        SITE: orders?.filter(o => o.channel === 'SITE').length || 0,
        WHATSAPP: orders?.filter(o => o.channel === 'WHATSAPP').length || 0,
      };

      // Orders by type
      const byType = {
        PRESENCIAL: orders?.filter(o => o.order_type === 'PRESENCIAL').length || 0,
        DELIVERY: orders?.filter(o => o.order_type === 'DELIVERY').length || 0,
      };

      return {
        dailySales,
        topProducts,
        totalRevenue,
        totalOrders,
        averageTicket,
        byChannel,
        byType,
      };
    },
  });
}
