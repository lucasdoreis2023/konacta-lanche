import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Header } from '@/components/layout/Header';
import { toast } from 'sonner';
import { Loader2, Lock, UtensilsCrossed, AlertCircle } from 'lucide-react';

export default function TableActivation() {
  const { tableNumber } = useParams<{ tableNumber: string }>();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [isChecking, setIsChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tableExists, setTableExists] = useState(false);
  const [isOccupied, setIsOccupied] = useState(false);

  const num = parseInt(tableNumber || '0');

  useEffect(() => {
    checkTable();
  }, [num]);

  const checkTable = async () => {
    setIsChecking(true);
    try {
      // Check if table exists
      const { data: table, error } = await supabase
        .from('tables')
        .select('table_number, active')
        .eq('table_number', num)
        .eq('active', true)
        .maybeSingle();

      if (error) throw error;
      setTableExists(!!table);

      if (table) {
        // Check if table has open orders
        const { data: openOrders } = await supabase
          .from('orders')
          .select('id')
          .eq('table_number', num)
          .eq('order_type', 'PRESENCIAL')
          .in('status', ['RECEBIDO', 'EM_PREPARO', 'PRONTO'])
          .limit(1);

        setIsOccupied((openOrders?.length ?? 0) > 0);
      }
    } catch (err) {
      console.error('Erro ao verificar mesa:', err);
    } finally {
      setIsChecking(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password.trim()) {
      toast.error('Digite a senha da mesa');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: table } = await supabase
        .from('tables')
        .select('password')
        .eq('table_number', num)
        .eq('active', true)
        .maybeSingle();

      if (!table) {
        toast.error('Mesa não encontrada');
        return;
      }

      if (table.password !== password.trim()) {
        toast.error('Senha incorreta');
        return;
      }

      // Re-check if occupied
      const { data: openOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('table_number', num)
        .eq('order_type', 'PRESENCIAL')
        .in('status', ['RECEBIDO', 'EM_PREPARO', 'PRONTO'])
        .limit(1);

      if ((openOrders?.length ?? 0) > 0) {
        toast.error('Esta mesa já possui uma conta aberta');
        setIsOccupied(true);
        return;
      }

      toast.success(`Mesa ${num} ativada!`);
      navigate(`/?mesa=${num}`);
    } catch (err) {
      console.error('Erro ao ativar mesa:', err);
      toast.error('Erro ao ativar mesa');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex items-center justify-center px-4 py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!tableExists) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex items-center justify-center px-4 py-20">
          <Card className="w-full max-w-sm text-center">
            <CardContent className="pt-6 space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <h2 className="text-xl font-semibold">Mesa não encontrada</h2>
              <p className="text-muted-foreground">
                A mesa {num} não existe ou está desativada.
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Ir para o cardápio
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (isOccupied) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto flex items-center justify-center px-4 py-20">
          <Card className="w-full max-w-sm text-center">
            <CardContent className="pt-6 space-y-4">
              <AlertCircle className="mx-auto h-12 w-12 text-amber-500" />
              <h2 className="text-xl font-semibold">Mesa {num} ocupada</h2>
              <p className="text-muted-foreground">
                Esta mesa já possui uma conta aberta. Peça ao atendente para fechar a conta antes de abrir uma nova.
              </p>
              <Button variant="outline" onClick={() => checkTable()}>
                Verificar novamente
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto flex items-center justify-center px-4 py-20">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <UtensilsCrossed className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Mesa {num}</CardTitle>
            <CardDescription>
              Digite a senha da mesa para começar a pedir
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Senha da mesa"
                  className="pl-10 text-center text-lg tracking-widest"
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="w-full gap-2" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Ativar Mesa'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
