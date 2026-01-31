import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Store, Truck, Clock, Save } from 'lucide-react';
import { StoreInfo, DeliverySettings, StoreHours, DayHours } from '@/types/database';

const dayLabels: Record<keyof StoreHours, string> = {
  monday: 'Segunda-feira',
  tuesday: 'Terça-feira',
  wednesday: 'Quarta-feira',
  thursday: 'Quinta-feira',
  friday: 'Sexta-feira',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

export default function AdminSettings() {
  const { data: settings, isLoading, updateSetting } = useStoreSettings();
  
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [delivery, setDelivery] = useState<DeliverySettings | null>(null);
  const [hours, setHours] = useState<StoreHours | null>(null);

  // Initialize state when data loads
  if (settings && !storeInfo) {
    setStoreInfo(settings.storeInfo);
    setDelivery(settings.delivery);
    setHours(settings.hours);
  }

  const handleSaveStoreInfo = () => {
    if (storeInfo) {
      updateSetting.mutate({ key: 'store_info', value: storeInfo });
    }
  };

  const handleSaveDelivery = () => {
    if (delivery) {
      updateSetting.mutate({ key: 'delivery', value: delivery });
    }
  };

  const handleSaveHours = () => {
    if (hours) {
      updateSetting.mutate({ key: 'hours', value: hours });
    }
  };

  const updateDayHours = (day: keyof StoreHours, field: keyof DayHours, value: string | boolean) => {
    if (!hours) return;
    setHours({
      ...hours,
      [day]: {
        ...hours[day],
        [field]: value,
      },
    });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Configure as informações da sua lanchonete
          </p>
        </div>

        <Tabs defaultValue="store" className="space-y-6">
          <TabsList>
            <TabsTrigger value="store" className="gap-2">
              <Store className="h-4 w-4" />
              Loja
            </TabsTrigger>
            <TabsTrigger value="delivery" className="gap-2">
              <Truck className="h-4 w-4" />
              Entrega
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="h-4 w-4" />
              Horários
            </TabsTrigger>
          </TabsList>

          {/* Store Info Tab */}
          <TabsContent value="store">
            <Card>
              <CardHeader>
                <CardTitle>Informações da Loja</CardTitle>
                <CardDescription>
                  Dados básicos que aparecem no site e mensagens
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="storeName">Nome da Loja</Label>
                  <Input
                    id="storeName"
                    value={storeInfo?.name || ''}
                    onChange={(e) => setStoreInfo(prev => prev ? { ...prev, name: e.target.value } : null)}
                    placeholder="Minha Lanchonete"
                  />
                </div>
                <div>
                  <Label htmlFor="storePhone">Telefone / WhatsApp</Label>
                  <Input
                    id="storePhone"
                    value={storeInfo?.phone || ''}
                    onChange={(e) => setStoreInfo(prev => prev ? { ...prev, phone: e.target.value } : null)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div>
                  <Label htmlFor="storeAddress">Endereço</Label>
                  <Input
                    id="storeAddress"
                    value={storeInfo?.address || ''}
                    onChange={(e) => setStoreInfo(prev => prev ? { ...prev, address: e.target.value } : null)}
                    placeholder="Rua Exemplo, 123 - Bairro"
                  />
                </div>
                <div>
                  <Label htmlFor="storeDescription">Descrição</Label>
                  <Textarea
                    id="storeDescription"
                    value={storeInfo?.description || ''}
                    onChange={(e) => setStoreInfo(prev => prev ? { ...prev, description: e.target.value } : null)}
                    placeholder="Uma breve descrição da sua lanchonete..."
                    rows={3}
                  />
                </div>
                <Button 
                  onClick={handleSaveStoreInfo}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Informações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivery Tab */}
          <TabsContent value="delivery">
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Entrega</CardTitle>
                <CardDescription>
                  Defina taxa de entrega e valores mínimos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">Delivery Ativo</p>
                    <p className="text-sm text-muted-foreground">
                      Habilitar ou desabilitar entregas
                    </p>
                  </div>
                  <Switch
                    checked={delivery?.enabled || false}
                    onCheckedChange={(checked) => 
                      setDelivery(prev => prev ? { ...prev, enabled: checked } : null)
                    }
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="deliveryFee">Taxa de Entrega (R$)</Label>
                    <Input
                      id="deliveryFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={delivery?.fee || 0}
                      onChange={(e) => 
                        setDelivery(prev => prev ? { ...prev, fee: parseFloat(e.target.value) || 0 } : null)
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="minOrder">Pedido Mínimo (R$)</Label>
                    <Input
                      id="minOrder"
                      type="number"
                      step="0.01"
                      min="0"
                      value={delivery?.min_order || 0}
                      onChange={(e) => 
                        setDelivery(prev => prev ? { ...prev, min_order: parseFloat(e.target.value) || 0 } : null)
                      }
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSaveDelivery}
                  disabled={updateSetting.isPending}
                >
                  {updateSetting.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Configurações
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours">
            <Card>
              <CardHeader>
                <CardTitle>Horário de Funcionamento</CardTitle>
                <CardDescription>
                  Configure os horários de abertura e fechamento
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {hours && (Object.keys(dayLabels) as Array<keyof StoreHours>).map((day) => (
                  <div 
                    key={day} 
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={hours[day]?.enabled || false}
                        onCheckedChange={(checked) => updateDayHours(day, 'enabled', checked)}
                      />
                      <span className="font-medium">{dayLabels[day]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={hours[day]?.open || '08:00'}
                        onChange={(e) => updateDayHours(day, 'open', e.target.value)}
                        disabled={!hours[day]?.enabled}
                        className="w-32"
                      />
                      <span className="text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={hours[day]?.close || '22:00'}
                        onChange={(e) => updateDayHours(day, 'close', e.target.value)}
                        disabled={!hours[day]?.enabled}
                        className="w-32"
                      />
                    </div>
                  </div>
                ))}

                <Button 
                  onClick={handleSaveHours}
                  disabled={updateSetting.isPending}
                  className="mt-4"
                >
                  {updateSetting.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Salvar Horários
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
