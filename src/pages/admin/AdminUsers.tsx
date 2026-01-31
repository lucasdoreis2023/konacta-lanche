import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminUsers() {
  const { data: admins, isLoading, addAdmin, removeAdmin } = useAdminUsers();
  const [newUserId, setNewUserId] = useState('');

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserId.trim()) {
      toast.error('Digite o ID do usuário');
      return;
    }
    
    try {
      await addAdmin.mutateAsync(newUserId.trim());
      setNewUserId('');
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Usuários</h1>
          <p className="text-muted-foreground">
            Adicione ou remova administradores do sistema
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Add Admin Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Adicionar Administrador
              </CardTitle>
              <CardDescription>
                Use o ID do usuário (UUID) para adicionar um novo administrador.
                O usuário deve ter uma conta cadastrada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddAdmin} className="space-y-4">
                <div>
                  <Label htmlFor="userId">ID do Usuário (UUID)</Label>
                  <Input
                    id="userId"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={addAdmin.isPending}
                  className="w-full"
                >
                  {addAdmin.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Adicionar Administrador
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Sobre Permissões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>Administradores</strong> têm acesso total ao painel, 
                incluindo gerenciamento de produtos, pedidos e configurações.
              </p>
              <p>
                Para encontrar o ID de um usuário, verifique a tabela 
                <code className="mx-1 rounded bg-muted px-1">auth.users</code> 
                no banco de dados.
              </p>
              <p>
                Novos usuários cadastrados não têm permissão de admin por padrão.
                Adicione manualmente quando necessário.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Admins List */}
        <Card>
          <CardHeader>
            <CardTitle>Administradores Atuais</CardTitle>
            <CardDescription>
              Lista de todos os usuários com permissão de administrador
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : admins && admins.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="w-24">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admins.map((admin) => (
                    <TableRow key={admin.id}>
                      <TableCell className="font-mono text-sm">
                        {admin.user_id}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          {admin.role}
                        </span>
                      </TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover Administrador?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação irá remover as permissões de administrador 
                                deste usuário. Ele não poderá mais acessar o painel.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeAdmin.mutate(admin.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remover
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <Shield className="mx-auto h-12 w-12 opacity-50" />
                <p className="mt-2">Nenhum administrador encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
