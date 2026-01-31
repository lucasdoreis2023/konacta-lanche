import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Estados da máquina de estados
type ConversationState =
  | "FIRST_CONTACT"
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
  | "AWAITING_ORDER_NUMBER"
  | "PROMOTIONS";

interface ConversationContext {
  cart: Array<{ productId: string; productName: string; quantity: number; price: number }>;
  selectedCategory?: string;
  customerName?: string;
  orderType?: "PRESENCIAL" | "DELIVERY";
  deliveryAddress?: string;
  paymentMethod?: "PIX" | "CARTAO" | "DINHEIRO";
  isFirstContact?: boolean;
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

// Saudações baseadas no horário
function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Delay helper
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Calcula delay baseado no tamanho da mensagem (simula digitação real)
function calculateTypingDelay(message: string): number {
  const wordsPerMinute = 200; // velocidade de digitação simulada
  const words = message.split(/\s+/).length;
  const baseDelay = (words / wordsPerMinute) * 60 * 1000;
  // Mínimo 1s, máximo 3s
  return Math.min(Math.max(baseDelay, 1000), 3000);
}

// Inicializa cliente Supabase
const getSupabase = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
};

// Envia status de "digitando"
async function sendTypingStatus(phone: string, duration: number = 2000): Promise<void> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada para typing");
    return;
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  const url = `${evolutionUrl}/chat/sendPresence/${instanceName}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        options: {
          delay: duration,
          presence: "composing"
        }
      }),
    });
  } catch (error) {
    console.error("Erro ao enviar typing:", error);
  }
}

// Envia mensagem via Evolution API com delay natural
async function sendWhatsAppMessage(phone: string, message: string, useTyping: boolean = true) {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada - faltam variáveis de ambiente");
    return;
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  
  // Envia status de digitando se habilitado
  if (useTyping) {
    const typingDuration = calculateTypingDelay(message);
    await sendTypingStatus(phone, typingDuration);
    await delay(typingDuration);
  }

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

// Envia múltiplas mensagens com delays naturais entre elas
async function sendMultipleMessages(phone: string, messages: string[]): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      // Delay entre mensagens (800ms - 1500ms)
      await delay(800 + Math.random() * 700);
    }
    await sendWhatsAppMessage(phone, messages[i], true);
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
    const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
    return sendWhatsAppMessage(phone, fallbackText);
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  
  // Envia typing antes dos botões
  const typingDuration = calculateTypingDelay(description);
  await sendTypingStatus(phone, typingDuration);
  await delay(typingDuration);

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
      const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
      return sendWhatsAppMessage(phone, fallbackText, false); // já fez typing
    }
  } catch (error) {
    console.error("Erro ao enviar botões:", error);
    const fallbackText = `${title}\n\n${description}\n\n${buttons.map((b, i) => `*${i + 1}* - ${b.text}`).join("\n")}`;
    return sendWhatsAppMessage(phone, fallbackText, false);
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
): Promise<{ state: ConversationState; context: ConversationContext; isNew: boolean }> {
  const { data: session } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("phone_number", phone)
    .maybeSingle();

  if (session) {
    return {
      state: session.current_state as ConversationState,
      context: (session.context_json as ConversationContext) || { cart: [] },
      isNew: false
    };
  }

  // Cria nova sessão - primeiro contato
  await supabase.from("conversation_sessions").insert({
    phone_number: phone,
    current_state: "FIRST_CONTACT",
    context_json: { cart: [], isFirstContact: true },
  });

  return { state: "FIRST_CONTACT", context: { cart: [], isFirstContact: true }, isNew: true };
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

// Busca produtos em promoção (os 5 mais baratos como "promoção")
async function getPromotionProducts(
  supabase: ReturnType<typeof getSupabase>
): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, category_id")
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(5);
  return data || [];
}

// Busca pedidos recentes do cliente pelo telefone
async function getCustomerOrders(
  supabase: ReturnType<typeof getSupabase>,
  phone: string
): Promise<Order[]> {
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
    RECEBIDO: { emoji: "📥", label: "Recebido", description: "Seu pedido foi recebido e está aguardando preparo" },
    EM_PREPARO: { emoji: "👨‍🍳", label: "Em Preparo", description: "Nossa equipe está preparando seu pedido com carinho" },
    PRONTO: { emoji: "✅", label: "Pronto", description: "Seu pedido ficou pronto!" },
    ENTREGUE: { emoji: "🎉", label: "Entregue", description: "Pedido entregue! Bom apetite!" },
    CANCELADO: { emoji: "❌", label: "Cancelado", description: "Este pedido foi cancelado" },
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

  const items = context.cart.map((item) => ({
    order_id: order.order_number,
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity,
  }));

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

// Mensagens de transição naturais
const naturalPhrases = {
  thinking: ["Um momento...", "Deixa eu ver aqui...", "Só um instante..."],
  understood: ["Entendi!", "Certo!", "Beleza!", "Perfeito!"],
  thanks: ["Obrigado!", "Valeu!", "Agradeço!"],
  confirmation: ["Anotado!", "Feito!", "Pode deixar!"],
};

function getRandomPhrase(type: keyof typeof naturalPhrases): string {
  const phrases = naturalPhrases[type];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

// Resultado do processamento pode ter múltiplas mensagens
interface ProcessResult {
  newState: ConversationState;
  messages: string[];
  newContext: ConversationContext;
}

// Processa mensagem baseado no estado
async function processMessage(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  message: string,
  state: ConversationState,
  context: ConversationContext
): Promise<ProcessResult> {
  const msgLower = message.toLowerCase().trim();
  let newContext = { ...context };
  const greeting = getTimeGreeting();

  // Comandos globais
  if (["cancelar", "sair", "voltar ao inicio", "reiniciar", "inicio", "início"].includes(msgLower)) {
    newContext = { cart: [] };
    return {
      newState: "WELCOME",
      messages: [
        "🔄 Sem problemas! Vamos recomeçar.",
        `${greeting}! Que bom ter você aqui! 🍔\n\nO que gostaria de fazer?\n\n*1* - 📋 Ver cardápio\n*2* - 🔥 Ver promoções\n*3* - 📦 Acompanhar pedido`
      ],
      newContext,
    };
  }

  if (["carrinho", "ver carrinho", "meu carrinho"].includes(msgLower)) {
    if (newContext.cart.length === 0) {
      return {
        newState: state,
        messages: ["🛒 Seu carrinho está vazio ainda!\n\nDigite *CARDÁPIO* para ver nossos deliciosos produtos."],
        newContext,
      };
    }
    const cartList = newContext.cart
      .map((item, i) => `${i + 1}. ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return {
      newState: "CART",
      messages: [
        `🛒 *Seu Carrinho*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
        "O que deseja fazer?\n\n*FINALIZAR* - Fechar pedido\n*LIMPAR* - Esvaziar carrinho\n*CARDÁPIO* - Adicionar mais itens"
      ],
      newContext,
    };
  }

  // Comando global para consultar status
  if (isStatusQuery(message)) {
    const orders = await getCustomerOrders(supabase, phone);
    
    if (orders.length === 0) {
      return {
        newState: state,
        messages: [
          "📭 Você não tem pedidos em andamento no momento.",
          "Que tal fazer um pedido? Digite *CARDÁPIO* para começar! 😋"
        ],
        newContext,
      };
    }
    
    if (orders.length === 1) {
      const order = orders[0];
      const status = formatOrderStatus(order.status);
      const orderType = order.order_type === "DELIVERY" ? "🛵 Delivery" : "🏃 Retirada no local";
      
      return {
        newState: state,
        messages: [
          "📦 Encontrei seu pedido!",
          `*PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n${orderType}\n💰 Total: ${formatPrice(order.total)}`
        ],
        newContext,
      };
    }
    
    const ordersList = orders
      .map(o => {
        const status = formatOrderStatus(o.status);
        return `• *#${o.order_number}* - ${status.emoji} ${status.label}`;
      })
      .join("\n");
    
    return {
      newState: "AWAITING_ORDER_NUMBER",
      messages: [
        "📦 Você tem mais de um pedido em andamento:",
        `${ordersList}\n\nMe diz o *número do pedido* que você quer consultar.`
      ],
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
          messages: [
            "Achei! 🔍",
            `*PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n${orderType}\n💰 Total: ${formatPrice(order.total)}`,
            "Precisa de mais alguma coisa? Digite *CARDÁPIO* ou *STATUS*."
          ],
          newContext,
        };
      }
      
      return {
        newState: "AWAITING_ORDER_NUMBER",
        messages: [`Hmm, não encontrei o pedido #${orderNumber}. 🤔\n\nConfere o número e tenta de novo, ou digite *CANCELAR* para voltar.`],
        newContext,
      };
    }
    
    return {
      newState: "AWAITING_ORDER_NUMBER",
      messages: ["Me diz só o *número do pedido*, por favor. 😊\nExemplo: *123*"],
      newContext,
    };
  }

  // Primeiro contato - mensagem especial de boas-vindas
  if (state === "FIRST_CONTACT") {
    newContext.isFirstContact = false;
    
    return {
      newState: "WELCOME",
      messages: [
        `${greeting}! 👋`,
        "Seja muito bem-vindo(a) à nossa lanchonete! 🍔🍟",
        "É um prazer ter você aqui! Eu sou o assistente virtual e vou te ajudar com seu pedido.",
        `O que gostaria de fazer?\n\n*1* - 📋 Ver nosso cardápio\n*2* - 🔥 Ver promoções do dia\n*3* - 📦 Acompanhar um pedido`
      ],
      newContext,
    };
  }

  switch (state) {
    case "WELCOME": {
      // Ver promoções
      if (["2", "promoções", "promocoes", "promo", "promoção", "promocao"].includes(msgLower)) {
        const promos = await getPromotionProducts(supabase);
        
        if (promos.length === 0) {
          return {
            newState: "WELCOME",
            messages: [
              "😅 Ops! As promoções de hoje ainda não foram atualizadas.",
              "Mas nosso cardápio completo está disponível! Digite *1* ou *CARDÁPIO* para ver."
            ],
            newContext,
          };
        }
        
        const promoList = promos
          .map((p, i) => `*${i + 1}* - ${p.name}\n   💰 *${formatPrice(p.price)}*`)
          .join("\n\n");
        
        return {
          newState: "PROMOTIONS",
          messages: [
            "🔥 *PROMOÇÕES DO DIA* 🔥",
            `Olha só as ofertas especiais:\n\n${promoList}`,
            "Digite o *número* para adicionar ao carrinho ou *CARDÁPIO* para ver tudo!"
          ],
          newContext,
        };
      }

      // Acompanhar pedido
      if (["3", "pedido", "acompanhar", "status"].includes(msgLower)) {
        const orders = await getCustomerOrders(supabase, phone);
        
        if (orders.length === 0) {
          return {
            newState: "WELCOME",
            messages: [
              "📭 Você ainda não tem pedidos em andamento.",
              "Vamos fazer um? Digite *1* ou *CARDÁPIO* para começar! 😋"
            ],
            newContext,
          };
        }
        
        if (orders.length === 1) {
          const order = orders[0];
          const status = formatOrderStatus(order.status);
          return {
            newState: "WELCOME",
            messages: [
              `📦 *PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}`,
              "Quer fazer um novo pedido? Digite *CARDÁPIO*!"
            ],
            newContext,
          };
        }
        
        const ordersList = orders.map(o => {
          const status = formatOrderStatus(o.status);
          return `• *#${o.order_number}* - ${status.emoji} ${status.label}`;
        }).join("\n");
        
        return {
          newState: "AWAITING_ORDER_NUMBER",
          messages: [`Seus pedidos:\n\n${ordersList}\n\nQual número você quer consultar?`],
          newContext,
        };
      }

      // Ver cardápio
      if (["1", "cardapio", "cardápio", "menu", "ver menu", "oi", "olá", "ola", "oie", "eae", "e aí"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        newContext.selectedCategory = undefined;
        return {
          newState: "MENU",
          messages: [
            "📋 *NOSSO CARDÁPIO*",
            `Escolha uma categoria:\n\n${categoryList}\n\nDigite o *número* da categoria.`
          ],
          newContext,
        };
      }
      
      return {
        newState: "WELCOME",
        messages: [
          `${greeting}! Que bom ter você de volta! 😊`,
          `O que deseja?\n\n*1* - 📋 Ver cardápio\n*2* - 🔥 Promoções\n*3* - 📦 Meus pedidos`
        ],
        newContext,
      };
    }

    case "PROMOTIONS": {
      const promos = await getPromotionProducts(supabase);
      const index = parseInt(msgLower) - 1;

      if (index >= 0 && index < promos.length) {
        const product = promos[index];
        
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
          newState: "PROMOTIONS",
          messages: [
            `✅ *${product.name}* adicionado!`,
            `🛒 Carrinho: ${newContext.cart.length} item(ns) - ${formatPrice(cartTotal)}\n\nMais alguma coisa?\n\n*CARRINHO* - Ver pedido\n*CARDÁPIO* - Ver tudo\n*FINALIZAR* - Fechar pedido`
          ],
          newContext,
        };
      }

      if (["cardapio", "cardápio", "menu"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        return {
          newState: "MENU",
          messages: [`📋 *CARDÁPIO*\n\n${categoryList}\n\nDigite o número da categoria.`],
          newContext,
        };
      }

      if (["finalizar", "fechar"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "PROMOTIONS",
            messages: ["Seu carrinho está vazio! Escolha um produto primeiro. 😊"],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Ótima escolha! 🎉", "Me diz seu *nome* para eu anotar no pedido:"],
          newContext,
        };
      }

      return {
        newState: "PROMOTIONS",
        messages: ["Não entendi 😅 Digite o *número* do produto ou *CARDÁPIO* para ver mais opções."],
        newContext,
      };
    }

    case "MENU": {
      if (["oi", "olá", "ola", "oie", "bom dia", "boa tarde", "boa noite"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        return {
          newState: "MENU",
          messages: [`${greeting}! 👋\n\n📋 *CARDÁPIO*\n\n${categoryList}\n\nDigite o número da categoria.`],
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
            messages: ["😕 Esta categoria está vazia no momento. Escolha outra!"],
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
          messages: [
            `🍽️ *${category.name.toUpperCase()}*`,
            `${productList}`,
            "Digite o *número* do produto para adicionar ao carrinho.\n\n*VOLTAR* - Outras categorias"
          ],
          newContext,
        };
      }

      if (msgLower === "voltar") {
        return {
          newState: "WELCOME",
          messages: [`O que deseja?\n\n*1* - 📋 Cardápio\n*2* - 🔥 Promoções\n*3* - 📦 Meus pedidos`],
          newContext,
        };
      }

      const categoriesForHelp = await getCategories(supabase);
      const categoryListHelp = categoriesForHelp
        .map((cat, i) => `*${i + 1}* - ${cat.name}`)
        .join("\n");
      return {
        newState: "MENU",
        messages: [`Não entendi 😅\n\nDigite o *número* da categoria:\n\n${categoryListHelp}`],
        newContext,
      };
    }

    case "CATEGORY": {
      if (["finalizar", "fechar", "concluir"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "CATEGORY",
            messages: ["🛒 Carrinho vazio! Adicione produtos primeiro.\n\nDigite o *número* do produto."],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Perfeito! Vamos finalizar seu pedido. 🎉", "Me diz seu *nome*:"],
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
          messages: [`📋 *CARDÁPIO*\n\n${categoryList}`],
          newContext,
        };
      }

      if (["carrinho", "ver carrinho"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "CATEGORY",
            messages: ["🛒 Carrinho vazio ainda!\n\nDigite o *número* do produto para adicionar."],
            newContext,
          };
        }
        const cartList = newContext.cart
          .map((item, i) => `${i + 1}. ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
          .join("\n");
        const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        return {
          newState: "CART",
          messages: [
            `🛒 *Seu Carrinho*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
            "*FINALIZAR* - Fechar pedido\n*LIMPAR* - Esvaziar\n*CARDÁPIO* - Adicionar mais"
          ],
          newContext,
        };
      }

      const products = await getProductsByCategory(supabase, newContext.selectedCategory!);
      const index = parseInt(msgLower) - 1;

      if (index >= 0 && index < products.length) {
        const product = products[index];

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
          messages: [
            `✅ *${product.name}* adicionado!`,
            `🛒 ${newContext.cart.length} item(ns) - ${formatPrice(cartTotal)}\n\nMais algum? Digite o número!\n\n*VOLTAR* - Outras categorias\n*FINALIZAR* - Fechar pedido`
          ],
          newContext,
        };
      }

      const productList = products
        .map(
          (p, i) =>
            `*${i + 1}* - ${p.name} - ${formatPrice(p.price)}`
        )
        .join("\n");
      
      return {
        newState: "CATEGORY",
        messages: [`Não entendi 😅\n\nDigite o *número*:\n\n${productList}`],
        newContext,
      };
    }

    case "CART": {
      if (msgLower === "limpar") {
        newContext.cart = [];
        return {
          newState: "WELCOME",
          messages: ["🗑️ Carrinho esvaziado!", "Digite *CARDÁPIO* quando quiser fazer um novo pedido."],
          newContext,
        };
      }

      if (["finalizar", "fechar", "concluir"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "WELCOME",
            messages: ["🛒 Carrinho vazio! Digite *CARDÁPIO* para adicionar produtos."],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Ótimo! Vamos fechar seu pedido. 🎉", "Qual seu *nome*?"],
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
          messages: [`📋 *CARDÁPIO*\n\n${categoryList}`],
          newContext,
        };
      }

      return {
        newState: "CART",
        messages: ["O que deseja?\n\n*FINALIZAR* - Fechar pedido\n*LIMPAR* - Esvaziar\n*CARDÁPIO* - Adicionar mais"],
        newContext,
      };
    }

    case "CHECKOUT_NAME": {
      if (message.trim().length < 2) {
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Preciso do seu nome completo para anotar no pedido. 😊"],
          newContext,
        };
      }

      newContext.customerName = message.trim();

      return {
        newState: "CHECKOUT_TYPE",
        messages: [
          `Prazer, *${newContext.customerName}*! 👋`,
          `Como você quer receber?\n\n*1* - 🏃 Retirar no balcão\n*2* - 🛵 Delivery (+${formatPrice(5)})`
        ],
        newContext,
      };
    }

    case "CHECKOUT_TYPE": {
      if (msgLower === "1" || msgLower.includes("retirar") || msgLower.includes("balcão")) {
        newContext.orderType = "PRESENCIAL";
        return {
          newState: "CHECKOUT_PAYMENT",
          messages: [
            getRandomPhrase("understood"),
            "💳 Como vai pagar?\n\n*1* - 💵 Dinheiro\n*2* - 📱 PIX\n*3* - 💳 Cartão"
          ],
          newContext,
        };
      }

      if (msgLower === "2" || msgLower.includes("delivery") || msgLower.includes("entrega")) {
        newContext.orderType = "DELIVERY";
        return {
          newState: "CHECKOUT_ADDRESS",
          messages: [
            "🛵 Delivery, então!",
            "Me passa o *endereço completo* para entrega:\n(Rua, número, bairro e complemento)"
          ],
          newContext,
        };
      }

      return {
        newState: "CHECKOUT_TYPE",
        messages: ["Digite *1* para retirar ou *2* para delivery."],
        newContext,
      };
    }

    case "CHECKOUT_ADDRESS": {
      if (message.trim().length < 10) {
        return {
          newState: "CHECKOUT_ADDRESS",
          messages: ["Preciso do endereço completo para não errar a entrega! 📍\n\nExemplo: Rua das Flores, 123, Centro, apto 101"],
          newContext,
        };
      }

      newContext.deliveryAddress = message.trim();

      return {
        newState: "CHECKOUT_PAYMENT",
        messages: [
          `📍 ${getRandomPhrase("confirmation")}`,
          "💳 Como vai pagar?\n\n*1* - 💵 Dinheiro\n*2* - 📱 PIX\n*3* - 💳 Cartão"
        ],
        newContext,
      };
    }

    case "CHECKOUT_PAYMENT": {
      const paymentMap: Record<string, "DINHEIRO" | "PIX" | "CARTAO"> = {
        "1": "DINHEIRO",
        "2": "PIX",
        "3": "CARTAO",
        "dinheiro": "DINHEIRO",
        "pix": "PIX",
        "cartao": "CARTAO",
        "cartão": "CARTAO",
      };

      const paymentKey = Object.keys(paymentMap).find(k => msgLower.includes(k) || msgLower === k);
      
      if (!paymentKey) {
        return {
          newState: "CHECKOUT_PAYMENT",
          messages: ["Digite *1* (Dinheiro), *2* (PIX) ou *3* (Cartão)."],
          newContext,
        };
      }

      newContext.paymentMethod = paymentMap[paymentKey];

      const cartList = newContext.cart
        .map((item) => `• ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
        .join("\n");
      const subtotal = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const deliveryFee = newContext.orderType === "DELIVERY" ? 5 : 0;
      const total = subtotal + deliveryFee;

      const paymentLabels = { DINHEIRO: "💵 Dinheiro", PIX: "📱 PIX", CARTAO: "💳 Cartão" };

      return {
        newState: "CONFIRM",
        messages: [
          "📝 *RESUMO DO PEDIDO*",
          `👤 *${newContext.customerName}*\n📍 ${newContext.orderType === "DELIVERY" ? newContext.deliveryAddress : "Retirada no local"}\n💳 ${paymentLabels[newContext.paymentMethod]}\n\n🛒 *Itens:*\n${cartList}\n\n💰 Subtotal: ${formatPrice(subtotal)}${deliveryFee > 0 ? `\n🛵 Entrega: ${formatPrice(deliveryFee)}` : ""}\n\n💵 *TOTAL: ${formatPrice(total)}*`,
          "Tudo certo? Digite *CONFIRMAR* para finalizar!"
        ],
        newContext,
      };
    }

    case "CONFIRM": {
      if (["confirmar", "sim", "ok", "confirma", "isso", "pode"].includes(msgLower)) {
        const orderNumber = await createOrder(supabase, newContext, phone);

        if (!orderNumber) {
          return {
            newState: "CONFIRM",
            messages: ["😥 Ops! Tive um probleminha. Tenta digitar *CONFIRMAR* de novo?"],
            newContext,
          };
        }

        newContext = { cart: [] };

        return {
          newState: "WELCOME",
          messages: [
            "✅ *PEDIDO CONFIRMADO!*",
            `🎉 Seu pedido *#${orderNumber}* foi recebido!`,
            "Estamos preparando com todo carinho. Você vai receber atualizações por aqui! 💛",
            "Obrigado pela preferência! Digite *CARDÁPIO* para novo pedido ou *STATUS* para acompanhar."
          ],
          newContext,
        };
      }

      if (["cancelar", "nao", "não", "desistir"].includes(msgLower)) {
        return {
          newState: "CART",
          messages: [
            "Tudo bem, sem problemas! 😊",
            "Seu carrinho continua salvo. Digite *CARRINHO* para ver ou *LIMPAR* para esvaziar."
          ],
          newContext,
        };
      }

      return {
        newState: "CONFIRM",
        messages: ["Digite *CONFIRMAR* para finalizar ou *CANCELAR* para voltar."],
        newContext,
      };
    }

    default:
      return {
        newState: "WELCOME",
        messages: [`${greeting}! Digite *CARDÁPIO* para ver nossos produtos. 😊`],
        newContext: { cart: [] },
      };
  }
}

// Handler principal
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook recebido:", JSON.stringify(body));

    const event = body.event;
    const data = body.data;

    if (event !== "messages.upsert") {
      return new Response(JSON.stringify({ status: "ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = data.key?.remoteJid?.replace("@s.whatsapp.net", "") || "";
    let message = "";
    
    if (data.message?.conversation) {
      message = data.message.conversation;
    }
    else if (data.message?.extendedTextMessage?.text) {
      message = data.message.extendedTextMessage.text;
    }
    else if (data.message?.buttonsResponseMessage?.selectedButtonId) {
      message = data.message.buttonsResponseMessage.selectedButtonId;
    }
    else if (data.message?.templateButtonReplyMessage?.selectedId) {
      message = data.message.templateButtonReplyMessage.selectedId;
    }
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
    const { state, context, isNew } = await getOrCreateSession(supabase, phone);

    const { newState, messages, newContext } = await processMessage(
      supabase,
      phone,
      message,
      state,
      context
    );

    await updateSession(supabase, phone, newState, newContext);

    // Envia múltiplas mensagens com delays naturais
    await sendMultipleMessages(phone, messages);

    // Notifica n8n se configurado
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
            response: messages.join("\n\n"),
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
