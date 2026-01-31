import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StoreInfo, DeliverySettings, StoreHours } from '@/types/database';
import { toast } from 'sonner';

interface StoreSettingsRow {
  id: string;
  key: string;
  value: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useStoreSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['store-settings'],
    queryFn: async () => {
      // Use raw fetch to avoid type issues with new table
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/store_settings?select=*`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data: StoreSettingsRow[] = await response.json();
      
      const settings: Record<string, unknown> = {};
      data?.forEach(row => {
        settings[row.key] = row.value;
      });
      
      return {
        storeInfo: (settings.store_info || { name: '', phone: '', address: '', description: '' }) as StoreInfo,
        delivery: (settings.delivery || { fee: 5, min_order: 20, enabled: true }) as DeliverySettings,
        hours: (settings.hours || {}) as StoreHours,
      };
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/store_settings?key=eq.${key}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ value }),
        }
      );
      
      if (!response.ok) throw new Error('Failed to update setting');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings'] });
      toast.success('Configurações salvas!');
    },
    onError: (error) => {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar configurações');
    },
  });

  return {
    ...query,
    updateSetting,
  };
}
