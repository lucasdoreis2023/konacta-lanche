import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { OrderType, PaymentMethod } from '@/types/database';

export default function Checkout() {
  const navigate = useNavigate();
  const { items, total, clearCart } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    customerName: '',
    customerPhone: '',
    orderType: 'PRESENCIAL' as OrderType,
    deliveryAddress: '',
    tableNumber: '',
    paymentMethod: 'DINHEIRO' as PaymentMethod,
    notes: '',
  });

  const deliveryFee = formData.orderType === 'DELIVERY' ? 5.0 : 0;
  const grandTotal = total + deliveryFee;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      toast.error('Adicione itens ao carrinho');
      return;
    }

    if (!formData.customerName.trim()) {
      toast.error('Informe seu nome');
      return;
    }

    if (formData.orderType === 'DELIVERY' && !formData.deliveryAddress.trim()) {
      toast.error('Informe o endereço de entrega');
      return;
    }

    if (formData.orderType === 'PRESENCIAL' && !formData.tableNumber.trim()) {
      toast.error('Informe o número da mesa');
      return;
    }

    setIsSubmitting(true);

    try {
      // Criar pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          channel: 'SITE',
          order_type: formData.orderType,
          customer_name: formData.customerName.trim(),
          customer_phone: formData.customerPhone.trim() || null,
          delivery_address: formData.orderType === 'DELIVERY' ? formData.deliveryAddress.trim() : null,
          table_number: formData.orderType === 'PRESENCIAL' ? parseInt(formData.tableNumber) : null,
          payment_method: formData.paymentMethod,
          subtotal: total,
          delivery_fee: deliveryFee,
          total: grandTotal,
          notes: formData.notes.trim() || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Criar itens do pedido
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        notes: item.notes || null,
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      clearCart();
      toast.success(`Pedido #${order.order_number} realizado com sucesso!`);
      navigate('/order-success', { state: { orderNumber: order.order_number } });
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      toast.error('Erro ao processar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 text-center">
          <h1 className="mb-4 text-2xl font-bold">Carrinho vazio</h1>
          <p className="mb-6 text-muted-foreground">
            Adicione itens ao carrinho para continuar
          </p>
          <Button onClick={() => navigate('/')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Cardápio
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => navigate('/')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Cardápio
        </Button>

        <h1 className="mb-6 text-3xl font-bold">Finalizar Pedido</h1>

        <div className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seus Dados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.customerName}
                    onChange={e => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    placeholder="Seu nome"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.customerPhone}
                    onChange={e => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tipo de Pedido</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.orderType}
                  onValueChange={(value: OrderType) => setFormData(prev => ({ ...prev, orderType: value }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PRESENCIAL" id="presencial" />
                    <Label htmlFor="presencial">Comer no local (mesa)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DELIVERY" id="delivery" />
                    <Label htmlFor="delivery">Delivery (+{formatPrice(5)})</Label>
                  </div>
                </RadioGroup>

                {formData.orderType === 'DELIVERY' && (
                  <div className="mt-4">
                    <Label htmlFor="address">Endereço de Entrega *</Label>
                    <Textarea
                      id="address"
                      value={formData.deliveryAddress}
                      onChange={e => setFormData(prev => ({ ...prev, deliveryAddress: e.target.value }))}
                      placeholder="Rua, número, bairro, complemento..."
                      required
                    />
                  </div>
                )}

                {formData.orderType === 'PRESENCIAL' && (
                  <div className="mt-4">
                    <Label htmlFor="tableNumber">Número da Mesa *</Label>
                    <Input
                      id="tableNumber"
                      type="number"
                      min="1"
                      value={formData.tableNumber}
                      onChange={e => setFormData(prev => ({ ...prev, tableNumber: e.target.value }))}
                      placeholder="Ex: 5"
                      required
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Forma de Pagamento</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={formData.paymentMethod}
                  onValueChange={(value: PaymentMethod) => setFormData(prev => ({ ...prev, paymentMethod: value }))}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DINHEIRO" id="dinheiro" />
                    <Label htmlFor="dinheiro">Dinheiro</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="PIX" id="pix" />
                    <Label htmlFor="pix">PIX</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CARTAO" id="cartao" />
                    <Label htmlFor="cartao">Cartão</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Observações</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Alguma observação sobre o pedido?"
                />
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                `Confirmar Pedido - ${formatPrice(grandTotal)}`
              )}
            </Button>
          </form>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Resumo do Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map(item => (
                  <div key={item.product.id} className="flex justify-between">
                    <span>
                      {item.quantity}x {item.product.name}
                    </span>
                    <span>{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                ))}
                <div className="border-t pt-4">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Taxa de entrega</span>
                      <span>{formatPrice(deliveryFee)}</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatPrice(grandTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
