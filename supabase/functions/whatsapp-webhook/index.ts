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
  | "PROMOTIONS"
  | "VOICE_ORDER_CONFIRM"
  | "VOICE_ORDERING"; // Novo estado para conversa por voz

// Palavras-chave para detecção de intenção
const INTENT_KEYWORDS = {
  menu: ["cardápio", "cardapio", "menu", "opções", "opcoes", "ver produtos", "o que tem", "quais produtos"],
  startOrder: ["pedido", "pedir", "quero", "gostaria", "lanche", "comer", "comprar", "fazer pedido", "realizar pedido"],
  status: ["status", "meu pedido", "acompanhar", "onde está", "onde esta", "cadê", "cade", "andamento", "rastrear"],
  greeting: ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "e aí", "e ai", "hello"],
  confirm: ["sim", "isso", "correto", "confirmar", "confirmo", "pode ser", "ok", "beleza", "certo"],
  deny: ["não", "nao", "errado", "cancelar", "refazer", "trocar"],
  finish: ["finalizar", "fechar", "concluir", "só isso", "so isso", "é isso", "e isso", "pronto", "acabou", "terminei"],
};

// Detecta intenção a partir do texto (transcrição ou mensagem)
function detectIntent(text: string): { intent: string; confidence: number } {
  const textLower = text.toLowerCase().trim();
  
  // Prioridade: finish > confirm > deny > status > menu > startOrder > greeting
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    for (const keyword of keywords) {
      if (textLower.includes(keyword)) {
        return { intent, confidence: 1 };
      }
    }
  }
  
  return { intent: "unknown", confidence: 0 };
}

interface ConversationContext {
  cart: Array<{ productId: string; productName: string; quantity: number; price: number }>;
  selectedCategory?: string;
  customerName?: string;
  orderType?: "PRESENCIAL" | "DELIVERY";
  deliveryAddress?: string;
  paymentMethod?: "PIX" | "CARTAO" | "DINHEIRO";
  isFirstContact?: boolean;
  pendingVoiceOrder?: {
    items: Array<{ name: string; quantity: number }>;
    transcript: string;
  };
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

// Calcula delay baseado no tamanho da mensagem
function calculateTypingDelay(message: string): number {
  const wordsPerMinute = 200;
  const words = message.split(/\s+/).length;
  const baseDelay = (words / wordsPerMinute) * 60 * 1000;
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

  if (!evolutionUrl || !evolutionKey || !instanceName) return;

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

// Envia status de "gravando áudio"
async function sendRecordingStatus(phone: string): Promise<void> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) return;

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
          delay: 3000,
          presence: "recording"
        }
      }),
    });
  } catch (error) {
    console.error("Erro ao enviar recording status:", error);
  }
}

// Envia mensagem via Evolution API com delay natural
async function sendWhatsAppMessage(phone: string, message: string, useTyping: boolean = true) {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada");
    return;
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  
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

    if (!response.ok) {
      console.error("Erro Evolution API:", response.status, await response.text());
    }
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
  }
}

// Envia múltiplas mensagens com delays naturais
async function sendMultipleMessages(phone: string, messages: string[]): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    if (i > 0) {
      await delay(800 + Math.random() * 700);
    }
    await sendWhatsAppMessage(phone, messages[i], true);
  }
}

// Baixa áudio do WhatsApp via Evolution API
async function downloadWhatsAppMedia(messageId: string): Promise<ArrayBuffer | null> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada para download de mídia");
    return null;
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  const url = `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        message: { key: { id: messageId } },
        convertToMp4: false
      }),
    });

    if (!response.ok) {
      console.error("Erro ao baixar mídia:", response.status, await response.text());
      return null;
    }

    const data = await response.json();
    
    if (data.base64) {
      // Converte base64 para ArrayBuffer
      const binaryString = atob(data.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }
    
    return null;
  } catch (error) {
    console.error("Erro ao baixar áudio:", error);
    return null;
  }
}

// Transcreve áudio usando ElevenLabs
async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<string | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY não configurada");
    return null;
  }

  try {
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: "audio/ogg" });
    formData.append("file", audioBlob, "audio.ogg");
    formData.append("model_id", "scribe_v2");
    formData.append("language_code", "por"); // Português

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error("Erro ElevenLabs STT:", response.status, await response.text());
      return null;
    }

    const result = await response.json();
    return result.text || null;
  } catch (error) {
    console.error("Erro na transcrição:", error);
    return null;
  }
}

// Gera áudio de resposta usando ElevenLabs TTS
async function generateTTSAudio(text: string): Promise<ArrayBuffer | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY não configurada para TTS");
    return null;
  }

  // Voice ID: Sarah (feminina, natural) - pode trocar por outra voz
  const voiceId = "EXAVITQu4vr4xnSDxMaL";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.1,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error("Erro ElevenLabs TTS:", response.status, await response.text());
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.error("Erro ao gerar áudio TTS:", error);
    return null;
  }
}

// Envia mensagem de áudio via Evolution API
async function sendWhatsAppAudio(phone: string, audioBuffer: ArrayBuffer): Promise<boolean> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada para áudio");
    return false;
  }

  evolutionUrl = evolutionUrl.replace(/\/manager\/?$/, "").replace(/\/$/, "");
  const url = `${evolutionUrl}/message/sendWhatsAppAudio/${instanceName}`;

  try {
    // Converte ArrayBuffer para base64 em chunks
    const bytes = new Uint8Array(audioBuffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    const base64Audio = btoa(binary);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        audio: `data:audio/mp3;base64,${base64Audio}`,
      }),
    });

    if (!response.ok) {
      console.error("Erro ao enviar áudio:", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Erro ao enviar áudio WhatsApp:", error);
    return false;
  }
}

// Envia resposta de voz (TTS) para o cliente
async function sendVoiceResponse(phone: string, text: string): Promise<void> {
  // Remove emojis e formatação para TTS
  const cleanText = text
    .replace(/\*([^*]+)\*/g, "$1") // Remove negrito
    .replace(/[🎤📝🛒💰✅❌📋🍔🍟👋🎉📦💛🔥🏃🛵💳💵📱📍🗑️😕🤔😊😋👨‍🍳📥📭🔄❓]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ", ")
    .trim();

  if (!cleanText || cleanText.length < 5) return;

  await sendRecordingStatus(phone);
  
  const audioBuffer = await generateTTSAudio(cleanText);
  if (audioBuffer) {
    await sendWhatsAppAudio(phone, audioBuffer);
  }
}

// Interpreta pedido usando Lovable AI
async function interpretVoiceOrder(
  transcript: string,
  products: Product[]
): Promise<{ items: Array<{ name: string; quantity: number; productId?: string; price?: number }>; understood: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY não configurada");
    return { items: [], understood: false };
  }

  const productList = products.map(p => `- ${p.name} (R$ ${p.price.toFixed(2)})`).join("\n");

  const systemPrompt = `Você é um assistente de pedidos de uma lanchonete. Analise a transcrição do áudio do cliente e extraia os itens do pedido.

CARDÁPIO DISPONÍVEL:
${productList}

REGRAS:
1. Extraia apenas produtos que existem no cardápio (pode haver variações no nome falado)
2. Identifique quantidades mencionadas (padrão: 1 se não especificado)
3. Associe nomes falados aos produtos do cardápio (ex: "x-burguer" pode ser "X-Burger", "refri" pode ser "Refrigerante")
4. Se o cliente não pedir nada claro, retorne items vazio

Responda APENAS com um JSON no formato:
{
  "items": [
    {"name": "Nome do Produto no Cardápio", "quantity": 1}
  ],
  "understood": true
}`;

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcrição do áudio: "${transcript}"` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("Erro Lovable AI:", response.status, await response.text());
      return { items: [], understood: false };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    // Extrai JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Associa produtos reais aos itens identificados
      const itemsWithProducts = parsed.items.map((item: { name: string; quantity: number }) => {
        const matchedProduct = products.find(p => 
          p.name.toLowerCase().includes(item.name.toLowerCase()) ||
          item.name.toLowerCase().includes(p.name.toLowerCase())
        );
        
        if (matchedProduct) {
          return {
            name: matchedProduct.name,
            quantity: item.quantity,
            productId: matchedProduct.id,
            price: matchedProduct.price
          };
        }
        return item;
      }).filter((item: { productId?: string }) => item.productId); // Remove itens não encontrados
      
      return {
        items: itemsWithProducts,
        understood: parsed.understood && itemsWithProducts.length > 0
      };
    }
    
    return { items: [], understood: false };
  } catch (error) {
    console.error("Erro ao interpretar pedido:", error);
    return { items: [], understood: false };
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

// Busca todos os produtos ativos
async function getAllProducts(supabase: ReturnType<typeof getSupabase>): Promise<Product[]> {
  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, category_id")
    .eq("active", true)
    .order("name");
  return data || [];
}

// Busca produtos em promoção
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

// Busca pedidos recentes do cliente
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

// Busca pedido por número
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

// Formata status do pedido
function formatOrderStatus(status: string): { emoji: string; label: string; description: string } {
  const statusMap: Record<string, { emoji: string; label: string; description: string }> = {
    RECEBIDO: { emoji: "📥", label: "Recebido", description: "Seu pedido foi recebido e está aguardando preparo" },
    EM_PREPARO: { emoji: "👨‍🍳", label: "Em Preparo", description: "Nossa equipe está preparando seu pedido" },
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

  const { data: orderData } = await supabase
    .from("orders")
    .select("id")
    .eq("order_number", order.order_number)
    .single();

  if (orderData) {
    const items = context.cart.map((item) => ({
      order_id: orderData.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));
    
    await supabase.from("order_items").insert(items);
  }

  return order.order_number;
}

// Verifica se é consulta de status
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

// Extrai número do pedido
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

// Frases naturais
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

interface ProcessResult {
  newState: ConversationState;
  messages: string[];
  newContext: ConversationContext;
}

// Processa áudio recebido
async function processAudioMessage(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  messageId: string,
  context: ConversationContext,
  currentState: ConversationState
): Promise<ProcessResult & { sendVoiceReply?: boolean; voiceText?: string }> {
  const greeting = getTimeGreeting();
  let newContext = { ...context };

  // Notifica que está processando
  await sendWhatsAppMessage(phone, "🎤 Recebi seu áudio! Processando...", false);
  await sendRecordingStatus(phone);

  // Baixa o áudio
  const audioBuffer = await downloadWhatsAppMedia(messageId);
  
  if (!audioBuffer) {
    return {
      newState: "WELCOME",
      messages: ["😕 Não consegui baixar o áudio. Pode tentar enviar novamente ou digitar seu pedido?"],
      newContext,
      sendVoiceReply: true,
      voiceText: "Não consegui baixar o áudio. Pode tentar enviar novamente?"
    };
  }

  // Transcreve o áudio
  const transcript = await transcribeAudio(audioBuffer);
  
  if (!transcript || transcript.trim().length < 3) {
    return {
      newState: "WELCOME",
      messages: [
        "😕 Não consegui entender o áudio.",
        "Pode tentar falar mais devagar ou digitar seu pedido?\n\nDigite *CARDÁPIO* para ver as opções."
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "Não consegui entender o áudio. Pode tentar falar mais devagar?"
    };
  }

  console.log(`Transcrição do áudio de ${phone}: ${transcript}`);
  
  // Detecta intenção do cliente
  const { intent } = detectIntent(transcript);
  console.log(`Intenção detectada: ${intent} para transcrição: "${transcript}"`);
  
  // Se está no estado VOICE_ORDER_CONFIRM, trata confirmação/negação
  if (currentState === "VOICE_ORDER_CONFIRM") {
    if (intent === "confirm") {
      newContext.pendingVoiceOrder = undefined;
      const cartTotal = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      return {
        newState: "CHECKOUT_NAME",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          "✅ Ótimo! Pedido confirmado no carrinho!",
          `🛒 Total atual: ${formatPrice(cartTotal)}`,
          "Vamos finalizar? Me diz seu *nome*:"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Ótimo! Pedido confirmado. Vamos finalizar. Me diz seu nome."
      };
    }
    
    if (intent === "deny") {
      const pendingItems = newContext.pendingVoiceOrder?.items || [];
      for (const pending of pendingItems) {
        const idx = newContext.cart.findIndex(c => 
          c.productName.toLowerCase() === pending.name.toLowerCase()
        );
        if (idx >= 0) {
          newContext.cart.splice(idx, 1);
        }
      }
      newContext.pendingVoiceOrder = undefined;
      
      return {
        newState: "WELCOME",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          "❌ Ok, cancelei os itens do áudio.",
          "Pode *enviar outro áudio* ou digitar *CARDÁPIO* para escolher manualmente!"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Ok, cancelei os itens. Pode enviar outro áudio com seu pedido."
      };
    }
  }
  
  // Se está no estado VOICE_ORDERING, continua adicionando itens
  if (currentState === "VOICE_ORDERING") {
    // Detecta se quer finalizar
    if (intent === "finish") {
      if (newContext.cart.length === 0) {
        return {
          newState: "VOICE_ORDERING",
          messages: [
            `📝 Ouvi: "${transcript}"`,
            "Seu carrinho está vazio! O que você gostaria de pedir?"
          ],
          newContext,
          sendVoiceReply: true,
          voiceText: "Seu carrinho está vazio. O que você gostaria de pedir?"
        };
      }
      
      const cartList = newContext.cart
        .map(item => `• ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
        .join("\n");
      const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      return {
        newState: "CHECKOUT_NAME",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          `🛒 *Seu pedido:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
          "Perfeito! Vamos finalizar. Me diz seu *nome*:"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: `Anotado! Seu total é ${formatPrice(total)}. Me diz seu nome para finalizar.`
      };
    }
  }
  
  // Trata intenções globais
  
  // INTENÇÃO: Cardápio/Menu
  if (intent === "menu") {
    const categories = await getCategories(supabase);
    const categoryList = categories
      .map((cat, i) => `*${i + 1}* - ${cat.name}`)
      .join("\n");
    
    return {
      newState: "MENU",
      messages: [
        `📝 Ouvi: "${transcript}"`,
        `📋 *NOSSO CARDÁPIO*\n\n${categoryList}\n\nDigite o *número* da categoria.\n\n🎤 Ou fale o que você quer pedir!`
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "Aqui está nosso cardápio! Pode falar o que você quer pedir ou escolher uma categoria."
    };
  }
  
  // INTENÇÃO: Status do pedido
  if (intent === "status") {
    const orders = await getCustomerOrders(supabase, phone);
    
    if (orders.length === 0) {
      return {
        newState: "WELCOME",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          "📭 Você não tem pedidos em andamento no momento.",
          "Que tal fazer um pedido? Fale o que você quer! 😋"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Você não tem pedidos em andamento. Que tal fazer um? Me fala o que você quer!"
      };
    }
    
    const order = orders[0];
    const status = formatOrderStatus(order.status);
    
    return {
      newState: "WELCOME",
      messages: [
        `📝 Ouvi: "${transcript}"`,
        `📦 *PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}`,
        "Quer fazer mais um pedido? É só falar!"
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: `Seu pedido número ${order.order_number} está ${status.label}. ${status.description}`
    };
  }
  
  // INTENÇÃO: Saudação ou início de pedido
  if (intent === "greeting" || intent === "startOrder") {
    // Se é saudação simples sem produtos específicos, entra em modo de conversa por voz
    const products = await getAllProducts(supabase);
    const interpretation = await interpretVoiceOrder(transcript, products);
    
    // Se identificou produtos, adiciona ao carrinho
    if (interpretation.understood && interpretation.items.length > 0) {
      // Adiciona itens ao carrinho
      for (const item of interpretation.items) {
        if (item.productId && item.price) {
          const existingItem = newContext.cart.find(c => c.productId === item.productId);
          if (existingItem) {
            existingItem.quantity += item.quantity;
          } else {
            newContext.cart.push({
              productId: item.productId,
              productName: item.name,
              quantity: item.quantity,
              price: item.price
            });
          }
        }
      }
      
      const itemsList = interpretation.items
        .map(item => `• ${item.quantity}x ${item.name}`)
        .join("\n");
      const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      return {
        newState: "VOICE_ORDERING",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          `✅ Anotado!\n\n${itemsList}`,
          `🛒 Total parcial: ${formatPrice(total)}`,
          "Deseja *mais alguma coisa*? Pode falar!\n\nOu diga *FINALIZAR* quando terminar."
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: `Anotado! ${interpretation.items.map(i => `${i.quantity} ${i.name}`).join(", ")}. Total parcial: ${formatPrice(total)}. Quer mais alguma coisa?`
      };
    }
    
    // Se não identificou produtos, pergunta o que quer pedir
    return {
      newState: "VOICE_ORDERING",
      messages: [
        `📝 Ouvi: "${transcript}"`,
        `${greeting}! Que bom que você quer fazer um pedido! 😊`,
        "O que você gostaria de pedir?\n\n🎤 Pode falar os itens diretamente!"
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: `${greeting}! Que bom! O que você gostaria de pedir?`
    };
  }

  // Se nenhuma intenção específica, tenta interpretar como pedido
  const products = await getAllProducts(supabase);
  const interpretation = await interpretVoiceOrder(transcript, products);

  if (!interpretation.understood || interpretation.items.length === 0) {
    // Não entendeu - mas detecta se há palavras que indicam desejo de pedir
    const wantsToBuy = /quero|queria|gostaria|preciso|me vê|me da|me dá|manda|traz/i.test(transcript);
    
    if (wantsToBuy) {
      return {
        newState: "VOICE_ORDERING",
        messages: [
          `📝 Ouvi: "${transcript}"`,
          "Entendi que você quer fazer um pedido! 😊",
          "Mas não identifiquei os produtos. Pode falar mais claramente?\n\nExemplo: *quero dois hambúrgueres e uma coca*"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Entendi que você quer fazer um pedido. Pode falar mais claramente o que deseja? Por exemplo: quero dois hambúrgueres e uma coca."
      };
    }
    
    return {
      newState: currentState === "VOICE_ORDERING" ? "VOICE_ORDERING" : "WELCOME",
      messages: [
        `📝 Ouvi: "${transcript}"`,
        "😊 O que você gostaria de fazer?\n\n🎤 *Fazer pedido* - fale os itens que deseja\n📋 *CARDÁPIO* - ver nossos produtos\n📦 *STATUS* - consultar seu pedido"
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "O que você gostaria de fazer? Pode falar os itens do pedido, pedir o cardápio ou consultar o status."
    };
  }

  // Adiciona itens ao carrinho
  for (const item of interpretation.items) {
    if (item.productId && item.price) {
      const existingItem = newContext.cart.find(c => c.productId === item.productId);
      if (existingItem) {
        existingItem.quantity += item.quantity;
      } else {
        newContext.cart.push({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          price: item.price
        });
      }
    }
  }

  const itemsList = interpretation.items
    .map(item => `• ${item.quantity}x ${item.name}`)
    .join("\n");
  const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return {
    newState: "VOICE_ORDERING",
    messages: [
      `📝 Ouvi: "${transcript}"`,
      `✅ Anotado!\n\n${itemsList}`,
      `🛒 Total parcial: ${formatPrice(total)}`,
      "Deseja *mais alguma coisa*? Pode falar!\n\nOu diga *FINALIZAR* quando terminar."
    ],
    newContext,
    sendVoiceReply: true,
    voiceText: `Anotado! ${interpretation.items.map(i => `${i.quantity} ${i.name}`).join(", ")}. Total parcial: ${formatPrice(total)}. Quer mais alguma coisa?`
  };
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
        `${greeting}! Que bom ter você aqui! 🍔\n\nO que gostaria de fazer?\n\n*1* - 📋 Ver cardápio\n*2* - 🔥 Ver promoções\n*3* - 📦 Acompanhar pedido\n\n🎤 Você também pode *enviar um áudio* com seu pedido!`
      ],
      newContext,
    };
  }

  if (["carrinho", "ver carrinho", "meu carrinho"].includes(msgLower)) {
    if (newContext.cart.length === 0) {
      return {
        newState: state,
        messages: ["🛒 Seu carrinho está vazio ainda!\n\nDigite *CARDÁPIO* para ver nossos produtos ou *envie um áudio* com seu pedido!"],
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

  // Consulta de status
  if (isStatusQuery(message)) {
    const orders = await getCustomerOrders(supabase, phone);
    
    if (orders.length === 0) {
      return {
        newState: state,
        messages: [
          "📭 Você não tem pedidos em andamento no momento.",
          "Que tal fazer um pedido? Digite *CARDÁPIO* ou *envie um áudio*! 😋"
        ],
        newContext,
      };
    }
    
    if (orders.length === 1) {
      const order = orders[0];
      const status = formatOrderStatus(order.status);
      
      return {
        newState: state,
        messages: [
          "📦 Encontrei seu pedido!",
          `*PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n💰 Total: ${formatPrice(order.total)}`
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

  // Estado de aguardar número do pedido
  if (state === "AWAITING_ORDER_NUMBER") {
    const orderNumber = extractOrderNumber(message);
    
    if (orderNumber) {
      const order = await getOrderByNumber(supabase, orderNumber);
      
      if (order) {
        const status = formatOrderStatus(order.status);
        
        return {
          newState: "WELCOME",
          messages: [
            "Achei! 🔍",
            `*PEDIDO #${order.order_number}*\n\n${status.emoji} *${status.label}*\n${status.description}\n\n💰 Total: ${formatPrice(order.total)}`,
            "Precisa de mais alguma coisa?"
          ],
          newContext,
        };
      }
      
      return {
        newState: "AWAITING_ORDER_NUMBER",
        messages: [`Hmm, não encontrei o pedido #${orderNumber}. 🤔\n\nConfere o número e tenta de novo.`],
        newContext,
      };
    }
    
    return {
      newState: "AWAITING_ORDER_NUMBER",
      messages: ["Me diz só o *número do pedido*. 😊\nExemplo: *123*"],
      newContext,
    };
  }

  // Confirmação de pedido por voz
  if (state === "VOICE_ORDER_CONFIRM") {
    if (["sim", "s", "confirmar", "isso", "correto", "certo"].includes(msgLower)) {
      // Limpa pedido pendente
      newContext.pendingVoiceOrder = undefined;
      
      const cartTotal = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      return {
        newState: "CHECKOUT_NAME",
        messages: [
          "✅ Ótimo! Pedido confirmado no carrinho!",
          `🛒 Total atual: ${formatPrice(cartTotal)}`,
          "Vamos finalizar? Me diz seu *nome*:"
        ],
        newContext,
      };
    }
    
    if (["nao", "não", "n", "errado", "refazer"].includes(msgLower)) {
      // Remove itens do carrinho que vieram do pedido por voz
      const pendingItems = newContext.pendingVoiceOrder?.items || [];
      for (const pending of pendingItems) {
        const idx = newContext.cart.findIndex(c => 
          c.productName.toLowerCase() === pending.name.toLowerCase()
        );
        if (idx >= 0) {
          newContext.cart.splice(idx, 1);
        }
      }
      newContext.pendingVoiceOrder = undefined;
      
      return {
        newState: "WELCOME",
        messages: [
          "❌ Ok, cancelei os itens do áudio.",
          "Pode *enviar outro áudio* ou digitar *CARDÁPIO* para escolher manualmente!"
        ],
        newContext,
      };
    }

    if (["cardapio", "cardápio"].includes(msgLower)) {
      newContext.pendingVoiceOrder = undefined;
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

    return {
      newState: "VOICE_ORDER_CONFIRM",
      messages: ["Digite *SIM* para confirmar ou *NÃO* para cancelar e tentar de novo."],
      newContext,
    };
  }

  // Estado de conversa por voz (continuando pedido)
  if (state === "VOICE_ORDERING") {
    // Detecta intenção via texto
    const { intent } = detectIntent(message);
    
    // Finalizar pedido
    if (intent === "finish" || ["finalizar", "fechar", "concluir", "so isso", "só isso", "é isso", "e isso", "pronto"].includes(msgLower)) {
      if (newContext.cart.length === 0) {
        return {
          newState: "VOICE_ORDERING",
          messages: [
            "🛒 Seu carrinho está vazio!",
            "O que você gostaria de pedir?\n\n🎤 Envie um *áudio* ou digite *CARDÁPIO* para ver as opções."
          ],
          newContext,
        };
      }
      
      const cartList = newContext.cart
        .map(item => `• ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
        .join("\n");
      const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      
      return {
        newState: "CHECKOUT_NAME",
        messages: [
          `🛒 *Seu pedido:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
          "Vamos finalizar? Me diz seu *nome*:"
        ],
        newContext,
      };
    }
    
    // Ver cardápio
    if (intent === "menu" || ["cardapio", "cardápio", "menu"].includes(msgLower)) {
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
    
    // Ver carrinho
    if (["carrinho", "ver carrinho"].includes(msgLower)) {
      if (newContext.cart.length === 0) {
        return {
          newState: "VOICE_ORDERING",
          messages: ["🛒 Carrinho vazio! O que você quer pedir?"],
          newContext,
        };
      }
      const cartList = newContext.cart
        .map((item, i) => `${i + 1}. ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
        .join("\n");
      const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      return {
        newState: "VOICE_ORDERING",
        messages: [
          `🛒 *Seu Carrinho*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
          "Quer *mais alguma coisa*? Ou diga *FINALIZAR* quando terminar."
        ],
        newContext,
      };
    }
    
    // Tenta interpretar como pedido adicional
    return {
      newState: "VOICE_ORDERING",
      messages: [
        "O que mais você gostaria?\n\n🎤 Envie um *áudio* com mais itens\n✅ *FINALIZAR* - Concluir pedido\n📋 *CARDÁPIO* - Ver opções"
      ],
      newContext,
    };
  }

  // Primeiro contato
  if (state === "FIRST_CONTACT") {
    newContext.isFirstContact = false;
    
    return {
      newState: "WELCOME",
      messages: [
        `${greeting}! 👋`,
        "Seja muito bem-vindo(a) à nossa lanchonete! 🍔🍟",
        "Eu sou o assistente virtual e vou te ajudar com seu pedido.",
        `O que gostaria de fazer?\n\n*1* - 📋 Ver nosso cardápio\n*2* - 🔥 Ver promoções do dia\n*3* - 📦 Acompanhar um pedido\n\n🎤 *Dica:* Você pode enviar um *áudio* falando seu pedido!`
      ],
      newContext,
    };
  }

  switch (state) {
    case "WELCOME": {
      if (["2", "promoções", "promocoes", "promo"].includes(msgLower)) {
        const promos = await getPromotionProducts(supabase);
        
        if (promos.length === 0) {
          return {
            newState: "WELCOME",
            messages: [
              "😅 As promoções ainda não foram atualizadas.",
              "Mas nosso cardápio completo está disponível! Digite *1* ou *CARDÁPIO*."
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
            `${promoList}`,
            "Digite o *número* para adicionar ou *CARDÁPIO* para ver tudo!"
          ],
          newContext,
        };
      }

      if (["3", "pedido", "acompanhar", "status"].includes(msgLower)) {
        const orders = await getCustomerOrders(supabase, phone);
        
        if (orders.length === 0) {
          return {
            newState: "WELCOME",
            messages: [
              "📭 Você ainda não tem pedidos em andamento.",
              "Vamos fazer um? Digite *CARDÁPIO* ou *envie um áudio*! 😋"
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

      if (["1", "cardapio", "cardápio", "menu", "oi", "olá", "ola"].includes(msgLower)) {
        const categories = await getCategories(supabase);
        const categoryList = categories
          .map((cat, i) => `*${i + 1}* - ${cat.name}`)
          .join("\n");
        newContext.selectedCategory = undefined;
        return {
          newState: "MENU",
          messages: [
            "📋 *NOSSO CARDÁPIO*",
            `${categoryList}\n\nDigite o *número* da categoria.\n\n🎤 Ou envie um *áudio* com seu pedido!`
          ],
          newContext,
        };
      }
      
      return {
        newState: "WELCOME",
        messages: [
          `${greeting}! Que bom ter você de volta! 😊`,
          `O que deseja?\n\n*1* - 📋 Ver cardápio\n*2* - 🔥 Promoções\n*3* - 📦 Meus pedidos\n\n🎤 Ou envie um *áudio* com seu pedido!`
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
            `🛒 ${newContext.cart.length} item(ns) - ${formatPrice(cartTotal)}\n\n*CARRINHO* - Ver pedido\n*FINALIZAR* - Fechar pedido`
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
          messages: [`📋 *CARDÁPIO*\n\n${categoryList}`],
          newContext,
        };
      }

      if (["finalizar", "fechar"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "PROMOTIONS",
            messages: ["Carrinho vazio! Escolha um produto primeiro. 😊"],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Ótima escolha! 🎉", "Me diz seu *nome*:"],
          newContext,
        };
      }

      return {
        newState: "PROMOTIONS",
        messages: ["Digite o *número* do produto ou *CARDÁPIO* para ver mais."],
        newContext,
      };
    }

    case "MENU": {
      const categories = await getCategories(supabase);
      const index = parseInt(msgLower) - 1;

      if (index >= 0 && index < categories.length) {
        const category = categories[index];
        const products = await getProductsByCategory(supabase, category.id);

        if (products.length === 0) {
          return {
            newState: "MENU",
            messages: ["😕 Esta categoria está vazia. Escolha outra!"],
            newContext,
          };
        }

        const productList = products
          .map((p, i) => `*${i + 1}* - ${p.name}\n   ${p.description || ""}\n   💰 ${formatPrice(p.price)}`)
          .join("\n\n");

        newContext.selectedCategory = category.id;

        return {
          newState: "CATEGORY",
          messages: [
            `🍽️ *${category.name.toUpperCase()}*`,
            `${productList}`,
            "Digite o *número* do produto.\n\n*VOLTAR* - Outras categorias"
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

      const categoryList = categories
        .map((cat, i) => `*${i + 1}* - ${cat.name}`)
        .join("\n");
      return {
        newState: "MENU",
        messages: [`Digite o *número* da categoria:\n\n${categoryList}`],
        newContext,
      };
    }

    case "CATEGORY": {
      if (["finalizar", "fechar"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "CATEGORY",
            messages: ["🛒 Carrinho vazio! Adicione produtos primeiro."],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Perfeito! 🎉", "Me diz seu *nome*:"],
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
            messages: ["🛒 Carrinho vazio!"],
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
            `🛒 ${newContext.cart.length} item(ns) - ${formatPrice(cartTotal)}\n\n*VOLTAR* - Categorias\n*FINALIZAR* - Fechar pedido`
          ],
          newContext,
        };
      }

      return {
        newState: "CATEGORY",
        messages: ["Digite o *número* do produto."],
        newContext,
      };
    }

    case "CART": {
      if (msgLower === "limpar") {
        newContext.cart = [];
        return {
          newState: "WELCOME",
          messages: ["🗑️ Carrinho esvaziado!", "Digite *CARDÁPIO* ou envie um *áudio* para novo pedido."],
          newContext,
        };
      }

      if (["finalizar", "fechar"].includes(msgLower)) {
        if (newContext.cart.length === 0) {
          return {
            newState: "WELCOME",
            messages: ["🛒 Carrinho vazio!"],
            newContext,
          };
        }
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Ótimo! 🎉", "Qual seu *nome*?"],
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
        messages: ["*FINALIZAR* - Fechar pedido\n*LIMPAR* - Esvaziar\n*CARDÁPIO* - Adicionar mais"],
        newContext,
      };
    }

    case "CHECKOUT_NAME": {
      if (message.trim().length < 2) {
        return {
          newState: "CHECKOUT_NAME",
          messages: ["Preciso do seu nome para anotar no pedido. 😊"],
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
      if (msgLower === "1" || msgLower.includes("retirar")) {
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

      if (msgLower === "2" || msgLower.includes("delivery")) {
        newContext.orderType = "DELIVERY";
        return {
          newState: "CHECKOUT_ADDRESS",
          messages: [
            "🛵 Delivery!",
            "Me passa o *endereço completo*:\n(Rua, número, bairro, complemento)"
          ],
          newContext,
        };
      }

      return {
        newState: "CHECKOUT_TYPE",
        messages: ["*1* para retirar ou *2* para delivery."],
        newContext,
      };
    }

    case "CHECKOUT_ADDRESS": {
      if (message.trim().length < 10) {
        return {
          newState: "CHECKOUT_ADDRESS",
          messages: ["Preciso do endereço completo! 📍"],
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
          messages: ["*1* Dinheiro, *2* PIX ou *3* Cartão."],
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
          `👤 *${newContext.customerName}*\n📍 ${newContext.orderType === "DELIVERY" ? newContext.deliveryAddress : "Retirada"}\n💳 ${paymentLabels[newContext.paymentMethod]}\n\n🛒 *Itens:*\n${cartList}\n\n💰 Subtotal: ${formatPrice(subtotal)}${deliveryFee > 0 ? `\n🛵 Entrega: ${formatPrice(deliveryFee)}` : ""}\n\n💵 *TOTAL: ${formatPrice(total)}*`,
          "*CONFIRMAR* para finalizar!"
        ],
        newContext,
      };
    }

    case "CONFIRM": {
      if (["confirmar", "sim", "ok"].includes(msgLower)) {
        const orderNumber = await createOrder(supabase, newContext, phone);

        if (!orderNumber) {
          return {
            newState: "CONFIRM",
            messages: ["😥 Erro! Tenta *CONFIRMAR* de novo?"],
            newContext,
          };
        }

        newContext = { cart: [] };

        return {
          newState: "WELCOME",
          messages: [
            "✅ *PEDIDO CONFIRMADO!*",
            `🎉 Pedido *#${orderNumber}* recebido!`,
            "Você receberá atualizações por aqui! 💛",
            "Obrigado! Digite *CARDÁPIO* para novo pedido."
          ],
          newContext,
        };
      }

      if (["cancelar", "nao", "não"].includes(msgLower)) {
        return {
          newState: "CART",
          messages: [
            "Ok! 😊",
            "Seu carrinho está salvo. *CARRINHO* para ver."
          ],
          newContext,
        };
      }

      return {
        newState: "CONFIRM",
        messages: ["*CONFIRMAR* para finalizar ou *CANCELAR*."],
        newContext,
      };
    }

    default:
      return {
        newState: "WELCOME",
        messages: [`${greeting}! Digite *CARDÁPIO* ou envie um *áudio*! 😊`],
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
    const messageId = data.key?.id || "";
    let message = "";
    let isAudioMessage = false;
    
    // Mensagem de texto
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
    // Mensagem de áudio
    else if (data.message?.audioMessage) {
      isAudioMessage = true;
      console.log(`Áudio recebido de ${phone}, messageId: ${messageId}`);
    }

    if (!phone || (!message && !isAudioMessage)) {
      return new Response(JSON.stringify({ status: "no_message" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`${isAudioMessage ? "Áudio" : "Mensagem"} de ${phone}: ${message || "[AUDIO]"}`);

    const supabase = getSupabase();
    const { state, context } = await getOrCreateSession(supabase, phone);

    let result: ProcessResult & { sendVoiceReply?: boolean; voiceText?: string };

    if (isAudioMessage) {
      // Processa áudio
      result = await processAudioMessage(supabase, phone, messageId, context, state);
    } else {
      // Processa texto
      result = await processMessage(supabase, phone, message, state, context);
    }

    await updateSession(supabase, phone, result.newState, result.newContext);

    // Envia mensagens (se não for áudio, pois áudio já envia durante processamento)
    if (!isAudioMessage) {
      await sendMultipleMessages(phone, result.messages);
    } else {
      // Para áudio, envia as mensagens de texto
      for (let i = 0; i < result.messages.length; i++) {
        if (i > 0) {
          await delay(800 + Math.random() * 700);
        }
        await sendWhatsAppMessage(phone, result.messages[i], true);
      }
      
      // Envia resposta em áudio se configurado
      if (result.sendVoiceReply && result.voiceText) {
        await delay(500);
        await sendVoiceResponse(phone, result.voiceText);
      }
    }

    // Notifica n8n
    const n8nUrl = Deno.env.get("N8N_WEBHOOK_URL");
    if (n8nUrl) {
      try {
        await fetch(n8nUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone,
            message: message || "[AUDIO]",
            isAudio: isAudioMessage,
            state: result.newState,
            context: result.newContext,
          }),
        });
      } catch (e) {
        console.error("Erro n8n:", e);
      }
    }

    return new Response(JSON.stringify({ status: "ok", newState: result.newState }), {
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
