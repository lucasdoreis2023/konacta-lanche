import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminUser {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  email?: string;
}

export function useAdminUsers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'admin');
      
      if (error) throw error;
      return data as AdminUser[];
    },
  });

  const addAdmin = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'admin' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Administrador adicionado!');
    },
    onError: (error) => {
      console.error('Erro:', error);
      toast.error('Erro ao adicionar administrador');
    },
  });

  const removeAdmin = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Administrador removido!');
    },
    onError: (error) => {
      console.error('Erro:', error);
      toast.error('Erro ao remover administrador');
    },
  });

  return {
    ...query,
    addAdmin,
    removeAdmin,
  };
}
