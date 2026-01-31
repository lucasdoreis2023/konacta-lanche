import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Estados da máquina de estados
type ConversationState =
  | "WELCOME"
  | "MENU"
  | "CATEGORY"
  | "PRODUCT"
  | "CART"
  | "CHECKOUT_NAME"
  | "CHECKOUT_TYPE"
  | "CHECKOUT_ADDRESS"
  | "CHECKOUT_PAYMENT"
  | "CONFIRM"
  | "AWAITING_ORDER_NUMBER";

interface ConversationContext {
  cart: Array<{ productId: string; productName: string; quantity: number; price: number }>;
  selectedCategory?: string;
  customerName?: string;
  orderType?: "PRESENCIAL" | "DELIVERY";
  deliveryAddress?: string;
  paymentMethod?: "PIX" | "CARTAO" | "DINHEIRO";
}

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
}

interface Order {
  id: string;
  order_number: number;
  status: string;
  order_type: string;
  total: number;
  created_at: string;
  customer_phone: string;
}

// Inicializa cliente Supabase
const getSupabase = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
};

// Envia mensagem via Evolution API
async function sendWhatsAppMessage(phone: string, message: string) {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada - faltam variáveis de ambiente");
    return;
  }

  // Remove trailing slash e /manager se existir
  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  
  const url = `${evolutionUrl}/message/sendText/${instanceName}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        text: message,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      console.error("Erro Evolution API:", response.status, responseText);
    }
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
  }
}

// Envia mensagem com botões via Evolution API
interface ButtonOption {
  buttonId: string;
  buttonText: { displayText: string };
}

async function sendWhatsAppButtons(
  phone: string,
  title: string,
  description: string,
  buttons: Array<{ id: string; text: string }>
) {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada");
    // Fallback para mensagem de texto
    const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
    return sendWhatsAppMessage(phone, fallbackText);
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  const url = `${evolutionUrl}/message/sendButtons/${instanceName}`;

  const buttonPayload: ButtonOption[] = buttons.map((b) => ({
    buttonId: b.id,
    buttonText: { displayText: b.text },
  }));

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        title: title,
        description: description,
        buttons: buttonPayload,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error("Erro ao enviar botões, usando fallback:", response.status, responseText);
      // Fallback para mensagem de texto simples
      const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
      return sendWhatsAppMessage(phone, fallbackText);
    }
  } catch (error) {
    console.error("Erro ao enviar botões:", error);
    // Fallback
    const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
    return sendWhatsAppMessage(phone, fallbackText);
  }
}

// Formata preço
function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

// Busca ou cria sessão
async function getOrCreateSession(
  supabase: ReturnType<typeof getSupabase>,
  phone: string
): Promise<{ state: ConversationState; context: ConversationContext }> {
  const { data: session } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();

  if (session) {
    return {
      state: session.current_state as ConversationState,
      context: (session.context_json as ConversationContext) || { cart: [] },
    };
  }

  // Cria nova sessão
  await supabase.from("conversation_sessions").insert({
    phone_number: phone,
    current_state: "WELCOME",
    context_json: { cart: [] },
  });

  return { state: "WELCOME", context: { cart: [] } };
}

// Atualiza sessão
async function updateSession(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  state: ConversationState,
  context: ConversationContext
) {
  await supabase
    .from("conversation_sessions")
    .update({
      current_state: state,
      context_json: context,
    })
    .eq("phone_number", phone);
}

// Busca categorias
async function getCategories(supabase: ReturnType<typeof getSupabase>): Promise<Category[]> {
  const { data } = await supabase
    .from("categories")
    .select("id, name")
    .eq("active", true)
    .order("display_order");
  return data || [];
}

// Busca produtos por categoria
async function getProductsByCategory(
  supabase: ReturnType<typeof getSupabase>,
  categoryId: string
): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, category_id")
    .eq("category_id", categoryId)
    .eq("active", true)
    .order("name");
  return data || [];
}

// Busca produto por ID
async function getProductById(
  supabase: ReturnType<typeof getSupabase>,
  productId: string
): Promise<Product | null> {
  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, category_id")
    .eq("id", productId)
    .maybeSingle();
  return data;
}

// Busca pedidos recentes do cliente pelo telefone
async function getCustomerOrders(
  supabase: ReturnType<typeof getSupabase>,
  phone: string
): Promise<Order[]> {
  // Normaliza o telefone para buscar (remove + e espaços)
  const normalizedPhone = phone.replace(/\D/g, "");
  
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, order_type, total, created_at, customer_phone")
    .or(`customer_phone.eq.${phone},customer_phone.eq.${normalizedPhone},customer_phone.ilike.%${normalizedPhone.slice(-8)}%`)
    .not("status", "in", '("ENTREGUE","CANCELADO")')
    .order("created_at", { ascending: false })
    .limit(5);
  
  return data || [];
}

// Busca pedido específico por número
async function getOrderByNumber(
  supabase: ReturnType<typeof getSupabase>,
  orderNumber: number
): Promise<Order | null> {
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, order_type, total, created_at, customer_phone")
    .eq("order_number", orderNumber)
    .maybeSingle();
  
  return data;
}

// Formata status do pedido para exibição
function formatOrderStatus(status: string): { emoji: string; label: string; description: string } {
  const statusMap: Record<string, { emoji: string; label: string; description: string }> = {
    RECEBIDO: { emoji: "📥", label: "Recebido", description: "Seu pedido foi recebido e está na fila" },
    EM_PREPARO: { emoji: "👨‍🍳", label: "Em Preparo", description: "Estamos preparando seu pedido" },
    PRONTO: { emoji: "✅", label: "Pronto", description: "Seu pedido está pronto!" },
    ENTREGUE: { emoji: "🎉", label: "Entregue", description: "Pedido entregue com sucesso" },
    CANCELADO: { emoji: "❌", label: "Cancelado", description: "Pedido foi cancelado" },
  };
  
  return statusMap[status] || { emoji: "❓", label: status, description: "Status desconhecido" };
}

// Cria pedido no banco
async function createOrder(
  supabase: ReturnType<typeof getSupabase>,
  context: ConversationContext,
  phone: string
): Promise<number | null> {
  const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = context.orderType === "DELIVERY" ? 5 : 0;
  const total = subtotal + deliveryFee;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      channel: "WHATSAPP",
      order_type: context.orderType,
      customer_name: context.customerName,
      customer_phone: phone,
      delivery_address: context.deliveryAddress,
      payment_method: context.paymentMethod,
      subtotal,
      delivery_fee: deliveryFee,
      total,
    })
    .select("order_number")
    .single();

  if (error || !order) {
    console.error("Erro ao criar pedido:", error);
    return null;
  }

  // Criar itens do pedido
  const items = context.cart.map((item) => ({
    order_id: order.order_number, // Isso está errado, precisa do ID
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity,
  }));

  // Buscar o ID real do pedido
  const { data: orderData } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", order.order_number)
    .single();

  if (orderData) {
    await supabase.from("order_items").insert(
      items.map((item) => ({ ...item, order_id: orderData.id }))
    );
  }

  return order.order_number;
}

// Verifica se a mensagem é uma consulta de status
function isStatusQuery(message: string): boolean {
  const statusKeywords = [
    "meu pedido", "meus pedidos", "status", "onde está",
    "onde esta", "cadê", "cade", "acompanhar", "rastrear",
    "situação", "situacao", "como está", "como esta",
    "pedido #", "pedido#", "consultar pedido", "ver pedido"
  ];
  const msgLower = message.toLowerCase().trim();
  return statusKeywords.some(keyword => msgLower.includes(keyword));
}

// Extrai número do pedido da mensagem
function extractOrderNumber(message: string): number | null {
  // Procura padrões como "pedido 123", "#123", "número 123", etc
  const patterns = [
    /pedido\s*#?\s*(\d+)/i,
    /#\s*(\d+)/,
    /n[úu]mero\s*(\d+)/i,
    /^(\d+)$/
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }
  
  return null;
}

// Processa mensagem baseado no estado
async function processMessage(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  message: string,
  state: ConversationState,
  context: ConversationContext
): Promise<{ newState: ConversationState; response: string; newContext: ConversationContext }> {
  const msgLower = message.toLowerCase().trim();
  let newContext = { ...context };

  // Comandos globais
  if (["cancelar", "sair", "voltar ao inicio", "reiniciar"].includes(msgLower)) {
    newContext = { cart: [] };
    return {
      newState: "WELCOME",
      response:
        "🔄 *Conversa reiniciada!*\n\nOlá! Bem-vindo à nossa lanchonete! 🍔\n\nDigite *CARDÁPIO* para ver nossos produtos.",
      newContext,
    };
  }

  if (["carrinho", "ver carrinho"].includes(msgLower)) {
    if (newContext.cart.length === 0) {
      return {
        newState: state,
        response: "🛒 Seu carrinho está vazio!\n\nDigite *CARDÁPIO* para ver nossos produtos.",
        newContext,
      };
    }
    const cartList = newContext.cart
      .map((item, i) => `${i + 1}. ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      newState: "CART",
      response: `🛒 *Seu Carrinho:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*\n\nDigite:\n*FINALIZAR* - para fazer o pedido\n*LIMPAR* - para esvaziar o carrinho\n*CARDÁPIO* - para adicionar mais itens`,
      newContext,
    };
  }

  // Comando global para consultar status (funciona em qualquer estado)
  if (isStatusQuery(message)) {
    const orders = await getCustomerOrders(supabase, phone);
    
    if (orders.length === 0) {
      return {
        newState: state,
        response: "📭 Você não possui pedidos em andamento no momento.\n\nDigite *CARDÁPIO* para fazer um novo pedido!",
        newContext,
      };
    }
    
    if (orders.length === 1) {
      const order = orders[0];
      const status = formatOrderStatus(order.status);
      const orderType = order.order_type === "DELIVERY" ? "🛵 Delivery" : "🏃 Retirada";
      
      return {
        newState: state,
        response: `📦 *STATUS DO PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n${orderType}\n💰 Total: ${formatPrice(order.total)}\n\nDigite *CARDÁPIO* para fazer um novo pedido.`,
        newContext,
      };
    }
    
    // Múltiplos pedidos - pede para informar o número
    const ordersList = orders
      .map(o => {
        const status = formatOrderStatus(o.status);
        return `• *#${o.order_number}* - ${status.emoji} ${status.label}`;
      })
      .join("\n");
    
    return {
      newState: "AWAITING_ORDER_NUMBER",
      response: `📦 *SEUS PEDIDOS EM ANDAMENTO*\n\n${ordersList}\n\nDigite o *número do pedido* para ver mais detalhes.\nEx: *${orders[0].order_number}*`,
      newContext,
    };
  }

  // Estado para aguardar número do pedido
  if (state === "AWAITING_ORDER_NUMBER") {
    const orderNumber = extractOrderNumber(message);
    
    if (orderNumber) {
      const order = await getOrderByNumber(supabase, orderNumber);
      
      if (order) {
        const status = formatOrderStatus(order.status);
        const orderType = order.order_type === "DELIVERY" ? "🛵 Delivery" : "🏃 Retirada";
        
        return {
          newState: "WELCOME",
          response: `📦 *STATUS DO PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n${orderType}\n💰 Total: ${formatPrice(order.total)}\n\nDigite *CARDÁPIO* para fazer um novo pedido ou *STATUS* para consultar outro pedido.`,
          newContext,
        };
      }
      
      return {
        newState: "AWAITING_ORDER_NUMBER",
        response: `❌ Pedido #${orderNumber} não encontrado.\n\nDigite o número correto do pedido ou *CANCELAR* para voltar.`,
        newContext,
      };
    }
    
    return {
      newState: "AWAITING_ORDER_NUMBER",
      response: "❌ Por favor, informe apenas o *número do pedido*.\nEx: *123* ou *pedido 123*",
      newContext,
    };
  }

  switch (state) {
    case "WELCOME": {
      if (["cardapio", "cardápio", "menu", "ver menu", "oi", "olá", "ola"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        newContext.selectedCategory = undefined;
        return {
          newState: "MENU",
          response: `📋 *CARDÁPIO*\n\nEscolha uma categoria:\n\n${categoryList}\n\nDigite o *número* da categoria desejada.`,
          newContext,
        };
      }
      return {
        newState: "WELCOME",
        response:
          "Olá! Bem-vindo à nossa lanchonete! 🍔\n\nDigite *CARDÁPIO* para ver nossos produtos,\n*CARRINHO* para ver seu pedido, ou\n*STATUS* para acompanhar seu pedido.",
        newContext,
      };
    }

    case "MENU": {
      // Aceita saudações e mostra o menu novamente
      if (["oi", "olá", "ola", "oie", "bom dia", "boa tarde", "boa noite", "oi!"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        return {
          newState: "MENU",
          response: `Olá! 👋 Que bom ter você aqui!\n\n📋 *CARDÁPIO*\n\nEscolha uma categoria:\n\n${categoryList}\n\nDigite o *número* da categoria desejada.`,
          newContext,
        };
      }

      const categories = await getCategories(supabase);
      const index = parseInt(msgLower) - 1;

      if (index >= 0 && index < categories.length) {
        const category = categories[index];
        const products = await getProductsByCategory(supabase, category.id);

        if (products.length === 0) {
          return {
            newState: "MENU",
            response: "😕 Esta categoria está vazia. Escolha outra categoria.",
            newContext,
          };
        }

        const productList = products
          .map(
            (p, i) =>
              `*${i + 1}* - ${p.name}\n   ${p.description || ""}\n   💰 ${formatPrice(p.price)}`
          )
          .join("\n\n");

        newContext.selectedCategory = category.id;

        return {
          newState: "CATEGORY",
          response: `🍽️ *${category.name.toUpperCase()}*\n\n${productList}\n\nDigite o *número* do produto para adicionar ao carrinho.\n\nOu digite *VOLTAR* para ver outras categorias.`,
          newContext,
        };
      }

      if (msgLower === "voltar") {
        return {
          newState: "WELCOME",
          response: "Digite *CARDÁPIO* para ver nossos produtos.",
          newContext,
        };
      }

      // Mensagem de ajuda mais amigável
      const categoriesForHelp = await getCategories(supabase);
      const categoryListHelp = categoriesForHelp
        .map((cat, i) => `*${i + 1}* - ${cat.name}`)
        .join("\n");
      return {
        newState: "MENU",
        response: `Não entendi 😅\n\n📋 *CARDÁPIO*\n\n${categoryListHelp}\n\nDigite o *número* da categoria (ex: *1* para ${categoriesForHelp[0]?.name || "Lanches"})`,
        newContext,
      };
    }

    case "CATEGORY": {
      // Aceita finalizar direto do estado de categoria
      if (["finalizar", "fechar", "concluir"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "CATEGORY",
            response: "🛒 Seu carrinho está vazio! Adicione produtos primeiro.\n\nDigite o *número* do produto desejado.",
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          response: "👤 *DADOS DO PEDIDO*\n\nQual é o seu *nome*?",
          newContext,
        };
      }

      if (msgLower === "voltar") {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        return {
          newState: "MENU",
          response: `📋 *CARDÁPIO*\n\nEscolha uma categoria:\n\n${categoryList}`,
          newContext,
        };
      }

      // Aceita ver carrinho
      if (["carrinho", "ver carrinho"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "CATEGORY",
            response: "🛒 Seu carrinho está vazio!\n\nDigite o *número* do produto para adicionar.",
            newContext,
          };
        }
        const cartList = newContext.cart
          .map((item, i) => `${i + 1}. ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
          .join("\n");
        const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        return {
          newState: "CART",
          response: `🛒 *Seu Carrinho:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*\n\nDigite:\n*FINALIZAR* - para fazer o pedido\n*LIMPAR* - para esvaziar o carrinho\n*CARDÁPIO* - para adicionar mais itens`,
          newContext,
        };
      }

      const products = await getProductsByCategory(supabase, newContext.selectedCategory!);
      const index = parseInt(msgLower) - 1;

      if (index >= 0 && index < products.length) {
        const product = products[index];

        // Adiciona ao carrinho
        const existingItem = newContext.cart.find((item) => item.productId === product.id);
        if (existingItem) {
          existingItem.quantity += 1;
        } else {
          newContext.cart.push({
            productId: product.id,
            productName: product.name,
            quantity: 1,
            price: product.price,
          });
        }

        const cartTotal = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

        return {
          newState: "CATEGORY",
          response: `✅ *${product.name}* adicionado ao carrinho!\n\n🛒 Carrinho: ${newContext.cart.length} item(ns) - ${formatPrice(cartTotal)}\n\nDigite outro *número* para adicionar mais,\n*CARRINHO* para ver seu pedido,\n*VOLTAR* para outras categorias, ou\n*FINALIZAR* para concluir.`,
          newContext,
        };
      }

      // Mostra produtos novamente se não entendeu
      const productList = products
        .map(
          (p, i) =>
            `*${i + 1}* - ${p.name}\n   ${p.description || ""}\n   💰 ${formatPrice(p.price)}`
        )
        .join("\n\n");
      
      return {
        newState: "CATEGORY",
        response: `Não entendi 😅\n\nDigite o *número* do produto:\n\n${productList}\n\nOu digite *VOLTAR* para ver outras categorias.`,
        newContext,
      };
    }

    case "CART": {
      if (msgLower === "limpar") {
        newContext.cart = [];
        return {
          newState: "WELCOME",
          response: "🗑️ Carrinho esvaziado!\n\nDigite *CARDÁPIO* para ver nossos produtos.",
          newContext,
        };
      }

      if (["finalizar", "fechar", "concluir"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "WELCOME",
            response: "🛒 Seu carrinho está vazio! Digite *CARDÁPIO* para adicionar produtos.",
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          response: "👤 *DADOS DO PEDIDO*\n\nQual é o seu *nome*?",
          newContext,
        };
      }

      if (["cardapio", "cardápio"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        return {
          newState: "MENU",
          response: `📋 *CARDÁPIO*\n\nEscolha uma categoria:\n\n${categoryList}`,
          newContext,
        };
      }

      return {
        newState: "CART",
        response:
          "Digite:\n*FINALIZAR* - para fazer o pedido\n*LIMPAR* - para esvaziar\n*CARDÁPIO* - para adicionar mais",
        newContext,
      };
    }

    case "CHECKOUT_NAME": {
      if (message.trim().length < 2) {
        return {
          newState: "CHECKOUT_NAME",
          response: "❌ Nome inválido. Por favor, informe seu nome completo.",
          newContext,
        };
      }

      newContext.customerName = message.trim();

      return {
        newState: "CHECKOUT_TYPE",
        response: `Olá, *${newContext.customerName}*! 👋\n\nComo deseja receber seu pedido?\n\n*1* - 🏃 Retirar no local\n*2* - 🛵 Delivery (+${formatPrice(5)})`,
        newContext,
      };
    }

    case "CHECKOUT_TYPE": {
      if (msgLower === "1") {
        newContext.orderType = "PRESENCIAL";
        return {
          newState: "CHECKOUT_PAYMENT",
          response:
            "💳 *FORMA DE PAGAMENTO*\n\n*1* - 💵 Dinheiro\n*2* - 📱 PIX\n*3* - 💳 Cartão",
          newContext,
        };
      }

      if (msgLower === "2") {
        newContext.orderType = "DELIVERY";
        return {
          newState: "CHECKOUT_ADDRESS",
          response: "📍 *ENDEREÇO DE ENTREGA*\n\nInforme seu endereço completo:\n(Rua, número, bairro, complemento)",
          newContext,
        };
      }

      return {
        newState: "CHECKOUT_TYPE",
        response: "❌ Opção inválida.\n\n*1* - Retirar no local\n*2* - Delivery",
        newContext,
      };
    }

    case "CHECKOUT_ADDRESS": {
      if (message.trim().length < 10) {
        return {
          newState: "CHECKOUT_ADDRESS",
          response: "❌ Endereço muito curto. Informe o endereço completo.",
          newContext,
        };
      }

      newContext.deliveryAddress = message.trim();

      return {
        newState: "CHECKOUT_PAYMENT",
        response:
          "💳 *FORMA DE PAGAMENTO*\n\n*1* - 💵 Dinheiro\n*2* - 📱 PIX\n*3* - 💳 Cartão",
        newContext,
      };
    }

    case "CHECKOUT_PAYMENT": {
      const paymentMap: Record<string, "DINHEIRO" | "PIX" | "CARTAO"> = {
        "1": "DINHEIRO",
        "2": "PIX",
        "3": "CARTAO",
      };

      if (!paymentMap[msgLower]) {
        return {
          newState: "CHECKOUT_PAYMENT",
          response: "❌ Opção inválida.\n\n*1* - Dinheiro\n*2* - PIX\n*3* - Cartão",
          newContext,
        };
      }

      newContext.paymentMethod = paymentMap[msgLower];

      // Monta resumo
      const cartList = newContext.cart
        .map((item) => `• ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
        .join("\n");
      const subtotal = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const deliveryFee = newContext.orderType === "DELIVERY" ? 5 : 0;
      const total = subtotal + deliveryFee;

      const paymentLabels = { DINHEIRO: "Dinheiro", PIX: "PIX", CARTAO: "Cartão" };

      return {
        newState: "CONFIRM",
        response: `📝 *CONFIRME SEU PEDIDO*\n\n👤 ${newContext.customerName}\n📍 ${newContext.orderType === "DELIVERY" ? newContext.deliveryAddress : "Retirada no local"}\n💳 ${paymentLabels[newContext.paymentMethod]}\n\n🛒 *Itens:*\n${cartList}\n\n💰 Subtotal: ${formatPrice(subtotal)}${deliveryFee > 0 ? `\n🛵 Entrega: ${formatPrice(deliveryFee)}` : ""}\n\n💵 *TOTAL: ${formatPrice(total)}*\n\nDigite *CONFIRMAR* para finalizar ou *CANCELAR* para desistir.`,
        newContext,
      };
    }

    case "CONFIRM": {
      if (["confirmar", "sim", "ok", "confirma"].includes(msgLower)) {
        const orderNumber = await createOrder(supabase, newContext, phone);

        if (!orderNumber) {
          return {
            newState: "CONFIRM",
            response:
              "❌ Erro ao processar pedido. Tente novamente digitando *CONFIRMAR*.",
            newContext,
          };
        }

        // Limpa contexto
        newContext = { cart: [] };

        return {
          newState: "WELCOME",
          response: `✅ *PEDIDO CONFIRMADO!*\n\n🎉 Seu pedido *#${orderNumber}* foi recebido!\n\nEstamos preparando com carinho. Você receberá atualizações sobre o status.\n\n💡 *Dica:* Digite *STATUS* a qualquer momento para acompanhar seu pedido!\n\nObrigado pela preferência! 💛\n\nDigite *CARDÁPIO* para fazer um novo pedido.`,
          newContext,
        };
      }

      if (["cancelar", "nao", "não"].includes(msgLower)) {
        return {
          newState: "CART",
          response:
            "❌ Pedido cancelado.\n\nSeu carrinho ainda está salvo. Digite *CARRINHO* para ver ou *LIMPAR* para esvaziar.",
          newContext,
        };
      }

      return {
        newState: "CONFIRM",
        response: "Digite *CONFIRMAR* para finalizar ou *CANCELAR* para desistir.",
        newContext,
      };
    }

    default:
      return {
        newState: "WELCOME",
        response: "Olá! Digite *CARDÁPIO* para ver nossos produtos.",
        newContext: { cart: [] },
      };
  }
}

// Handler principal
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook recebido:", JSON.stringify(body));

    // Formato Evolution API
    const event = body.event;
    const data = body.data;

    // Ignora eventos que não são mensagens recebidas
    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extrai mensagem - suporta texto normal, texto estendido e resposta de botões
    const phone = data.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
    let message = "";
    
    // Mensagem de texto normal
    if (data.message?.conversation) {
      message = data.message.conversation;
    }
    // Texto estendido (citação, etc)
    else if (data.message?.extendedTextMessage?.text) {
      message = data.message.extendedTextMessage.text;
    }
    // Resposta de botão
    else if (data.message?.buttonsResponseMessage?.selectedButtonId) {
      message = data.message.buttonsResponseMessage.selectedButtonId;
    }
    // Template button response
    else if (data.message?.templateButtonReplyMessage?.selectedId) {
      message = data.message.templateButtonReplyMessage.selectedId;
    }
    // Lista interativa
    else if (data.message?.listResponseMessage?.singleSelectReply?.selectedRowId) {
      message = data.message.listResponseMessage.singleSelectReply.selectedRowId;
    }

    if (!phone || !message) {
      return new Response(JSON.stringify({ status: "no_message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Mensagem de ${phone}: ${message}`);

    const supabase = getSupabase();

    // Busca sessão atual
    const { state, context } = await getOrCreateSession(supabase, phone);

    // Processa mensagem
    const { newState, response, newContext } = await processMessage(
      supabase,
      phone,
      message,
      state,
      context
    );

    // Atualiza sessão
    await updateSession(supabase, phone, newState, newContext);

    // Envia resposta
    await sendWhatsAppMessage(phone, response);

    // Notifica n8n se configurado (opcional)
    const n8nUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (n8nUrl) {
      try {
        await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            message,
            state: newState,
            context: newContext,
            response,
          }),
        });
      } catch (e) {
        console.error("Erro ao notificar n8n:", e);
      }
    }

    return new Response(JSON.stringify({ status: "ok", newState }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
