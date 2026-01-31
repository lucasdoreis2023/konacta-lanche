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

// Palavras-chave para detecção de intenção (ordem define prioridade)
const INTENT_KEYWORDS: Array<[string, string[]]> = [
  // PRIORIDADE 0: Solicitar revisão/atendente humano (MÁXIMA prioridade)
  ["review", ["revisar", "revisão", "revisao", "atendente", "humano", "pessoa", "falar com alguém", "falar com alguem", "atendimento humano", "quero revisar", "conferir pedido", "confirma pra mim"]],
  // PRIORIDADE 1: Finalizar/Fechar (mais importante)
  ["finish", ["finalizar", "finaliza", "fechar", "fecha", "concluir", "só isso", "so isso", "é isso", "e isso", "pronto", "acabou", "terminei", "pode finalizar", "pode fechar", "fecha o pedido", "finaliza o pedido", "finalizar pedido", "fechar pedido"]],
  // PRIORIDADE 2: Confirmação
  ["confirm", ["sim", "isso mesmo", "correto", "confirmar", "confirmo", "pode ser", "beleza", "certo", "isso aí", "isso ai", "exato"]],
  // PRIORIDADE 3: Negação
  ["deny", ["não", "nao", "errado", "cancelar", "refazer", "trocar", "cancela"]],
  // PRIORIDADE 4: Status
  ["status", ["status", "meu pedido está", "meu pedido esta", "acompanhar", "onde está meu", "onde esta meu", "cadê meu", "cade meu", "andamento", "rastrear"]],
  // PRIORIDADE 5: Cardápio
  ["menu", ["cardápio", "cardapio", "menu", "ver produtos", "o que tem", "quais produtos", "mostrar produtos"]],
  // PRIORIDADE 6: Saudação/Início de pedido
  ["greeting", ["oi", "olá", "ola", "bom dia", "boa tarde", "boa noite", "e aí", "e ai", "hello", "opa"]],
  // PRIORIDADE 7: Intenção de fazer pedido (mais genérico)
  ["startOrder", ["quero pedir", "gostaria de pedir", "fazer um pedido", "realizar pedido", "quero um", "quero uma", "me vê", "me ve", "me dá", "me da", "manda um", "traz um"]],
];

// Detecta intenção a partir do texto (transcrição ou mensagem)
function detectIntent(text: string): { intent: string; confidence: number } {
  const textLower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  
  // Itera na ordem de prioridade (primeiro match ganha)
  for (const [intent, keywords] of INTENT_KEYWORDS) {
    for (const keyword of keywords) {
      const keywordNorm = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (textLower.includes(keywordNorm)) {
        console.log(`[detectIntent] Match: "${keyword}" -> ${intent}`);
        return { intent, confidence: 1 };
      }
    }
  }
  
  return { intent: "unknown", confidence: 0 };
}

// Converte números por extenso para dígitos
function convertSpokenNumbersToDigits(text: string): string {
  const numberWords: Record<string, string> = {
    // Singular/feminino
    "uma": "1", "um": "1",
    // Plural
    "duas": "2", "dois": "2",
    "tres": "3", "três": "3",
    "quatro": "4",
    "cinco": "5",
    "seis": "6",
    "sete": "7",
    "oito": "8",
    "nove": "9",
    "dez": "10",
  };
  
  let result = text;
  
  // Substitui números por extenso antes de nomes de produtos
  // Ex: "duas coca cola" -> "2 coca cola"
  for (const [word, digit] of Object.entries(numberWords)) {
    // Usa regex para substituir apenas palavras inteiras
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    result = result.replace(regex, digit);
  }
  
  return result;
}

// Corrige transcrições de pronúncias brasileiras comuns
function fixTranscriptionPronunciation(text: string): string {
  let fixed = text;
  
  // Primeiro converte números por extenso para dígitos
  fixed = convertSpokenNumbersToDigits(fixed);
  
  // Correções de pronúncia para lanches "X-" (xis)
  // "exi bacon" -> "x-bacon", "xis bacon" -> "x-bacon", "shis bacon" -> "x-bacon"
  fixed = fixed.replace(/\b(exi|exis|xis|shis|chis|shi|chi)\s*(bacon|tudo|salada|egg|frango|calabresa|burger|burguer|picanha|costela|carne|queijo|misto)/gi, 
    (_, prefix, item) => `x-${item}`);
  
  // Também corrige quando vem junto: "exibacon" -> "x-bacon"
  fixed = fixed.replace(/\b(exi|xis|shis|chis)(bacon|tudo|salada|egg|frango|calabresa|burger|burguer|picanha|costela|carne|queijo|misto)/gi,
    (_, prefix, item) => `x-${item}`);
  
  // Correção para "x tudo", "x bacon" (sem hífen) -> "x-tudo", "x-bacon"
  fixed = fixed.replace(/\bx\s+(bacon|tudo|salada|egg|frango|calabresa|burger|burguer|picanha|costela|carne|queijo|misto)/gi,
    (_, item) => `x-${item}`);
  
  return fixed;
}

function normalizeText(input: string): string {
  // Primeiro aplica correções de pronúncia
  const corrected = fixTranscriptionPronunciation(input);
  
  return corrected
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ") // Mantém hífen para x-bacon
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isLikelyMoreItemsQuestion(text: string | undefined | null): boolean {
  if (!text) return false;
  const t = normalizeText(text);
  return /\b(mais\s+alguma\s+coisa|mais\s+alguma|algo\s+mais|quer\s+mais|deseja\s+mais)\b/.test(t);
}

function inferCartItemsFromMessage(
  message: string,
  products: Product[]
): Array<{ product: Product; quantity: number }> {
  const msg = normalizeText(message);
  if (!msg || msg.length < 3) return [];

  // Evita inferência em mensagens que claramente são checkout/controle
  if (/\b(pix|cartao|cartao|dinheiro|troco|entrega|delivery|retirada|buscar|endereco|rua|avenida|av|bairro)\b/.test(msg)) {
    return [];
  }

  const matches: Array<{ product: Product; quantity: number; score: number }> = [];

  for (const p of products) {
    const pn = normalizeText(p.name);
    if (!pn) continue;

    const directHit = msg.includes(pn);
    const reverseHit = pn.includes(msg) && msg.length >= 4;
    if (!directHit && !reverseHit) continue;

    // Tenta inferir quantidade (ex.: "2 x-tudo")
    const firstWord = pn.split(" ")[0];
    const qtyRe = new RegExp(`\\b(\\d+)\\s*(?:x\\s*)?(?:${escapeRegExp(firstWord)})\\b`);
    const qtyMatch = msg.match(qtyRe);
    const qty = qtyMatch ? Math.max(1, Number(qtyMatch[1])) : 1;

    matches.push({ product: p, quantity: qty, score: pn.length });
  }

  // Preferir matches mais específicos
  matches.sort((a, b) => b.score - a.score);

  const seen = new Set<string>();
  const result: Array<{ product: Product; quantity: number }> = [];
  for (const m of matches) {
    if (seen.has(m.product.id)) continue;
    seen.add(m.product.id);
    result.push({ product: m.product, quantity: m.quantity });
    if (result.length >= 4) break; // evita excesso
  }

  return result;
}

function mergeItemsIntoCart(
  context: ConversationContext,
  items: Array<{ product: Product; quantity: number }>
): boolean {
  if (!items.length) return false;
  if (!context.cart) context.cart = [];

  let changed = false;
  for (const { product, quantity } of items) {
    const existing = context.cart.find((c) => c.productId === product.id);
    if (existing) {
      existing.quantity += quantity;
      changed = true;
    } else {
      context.cart.push({
        productId: product.id,
        productName: product.name,
        quantity,
        price: product.price,
      });
      changed = true;
    }
  }

  return changed;
}

function applyDeterministicCheckoutExtraction(message: string, context: ConversationContext) {
  const raw = message.trim();
  const msg = normalizeText(raw);
  if (!msg) return;

  // Nome
  if (!isValidCustomerName(context.customerName) && isValidCustomerName(raw)) {
    context.customerName = raw.trim();
  }

  // Tipo (entrega/retirada)
  if (!context.orderType) {
    if (/\b(entrega|delivery)\b/.test(msg)) context.orderType = "DELIVERY";
    if (/\b(retirada|retirar|buscar|busca|presencial)\b/.test(msg)) context.orderType = "PRESENCIAL";
  }

  // Pagamento
  if (!context.paymentMethod) {
    if (/\bpix\b/.test(msg)) context.paymentMethod = "PIX";
    else if (/\b(cartao|cartao|credito|debito)\b/.test(msg)) context.paymentMethod = "CARTAO";
    else if (/\b(dinheiro|cash)\b/.test(msg)) context.paymentMethod = "DINHEIRO";
  }

  // Endereço (somente se for entrega e a mensagem parece endereço)
  if (context.orderType === "DELIVERY" && !context.deliveryAddress) {
    const looksLikeAddress = raw.length >= 10 && /\b(rua|r\b|avenida|av\b|travessa|alameda|praca|praça|estrada|rodovia|bairro|numero|n\b)\b/.test(msg);
    if (looksLikeAddress) context.deliveryAddress = raw;
  }

  // Troco (dinheiro)
  if (context.paymentMethod === "DINHEIRO" && !context.changeFor) {
    const m = msg.match(/\b(troco)\s*(?:para|p\/|pra)?\s*(\d+(?:[\.,]\d+)?)\b/);
    if (m?.[2]) {
      const v = Number(m[2].replace(",", "."));
      if (Number.isFinite(v) && v > 0) context.changeFor = v;
    }
  }
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
  // Histórico de conversa para contexto da IA
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string; inputType?: "text" | "audio" }>;
  // Troco necessário (se pagamento em dinheiro)
  changeFor?: number;
  // Contador de tentativas de confirmação com dados faltantes (para auto-revisão)
  confirmAttempts?: number;
  // Resumo da conversa para manter contexto sem usar muitos tokens
  conversationSummary?: string;
  // Timestamp do último resumo
  lastSummaryAt?: string;
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

// ============ FUNÇÕES DE AGRUPAMENTO DE MENSAGENS ============

// Configuração do agrupamento de mensagens
const MESSAGE_GROUPING_DELAY_MS = 3000; // 3 segundos de espera antes de processar

// Salva mensagem pendente para agrupamento
async function savePendingMessage(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  messageContent: string,
  messageId: string,
  inputType: "text" | "audio"
): Promise<void> {
  await supabase.from("pending_messages").insert({
    phone_number: phone,
    message_content: messageContent,
    message_id: messageId,
    input_type: inputType,
  });
  console.log(`[MessageGrouping] Mensagem salva para agrupamento: "${messageContent.slice(0, 50)}..."`);
}

// Busca e agrupa mensagens pendentes
async function getAndGroupPendingMessages(
  supabase: ReturnType<typeof getSupabase>,
  phone: string
): Promise<{ messages: string[]; inputType: "text" | "audio"; messageIds: string[] } | null> {
  const { data: pendingMessages, error } = await supabase
    .from("pending_messages")
    .select("*")
    .eq("phone_number", phone)
    .order("created_at", { ascending: true });
  
  if (error || !pendingMessages || pendingMessages.length === 0) {
    return null;
  }
  
  // Verifica se a última mensagem foi há mais de MESSAGE_GROUPING_DELAY_MS
  const lastMessage = pendingMessages[pendingMessages.length - 1];
  const lastMessageTime = new Date(lastMessage.created_at).getTime();
  const now = Date.now();
  const timeSinceLastMessage = now - lastMessageTime;
  
  if (timeSinceLastMessage < MESSAGE_GROUPING_DELAY_MS) {
    console.log(`[MessageGrouping] Aguardando mais ${MESSAGE_GROUPING_DELAY_MS - timeSinceLastMessage}ms para agrupar`);
    return null;
  }
  
  // Agrupa as mensagens
  const messages = pendingMessages.map(m => m.message_content);
  const messageIds = pendingMessages.map(m => m.id);
  // Determina o tipo de input predominante (se tiver áudio, considera áudio)
  const hasAudio = pendingMessages.some(m => m.input_type === "audio");
  
  console.log(`[MessageGrouping] Agrupando ${messages.length} mensagens: ${messages.join(" | ").slice(0, 100)}...`);
  
  return {
    messages,
    inputType: hasAudio ? "audio" : "text",
    messageIds
  };
}

// Deleta mensagens pendentes após processamento
async function deletePendingMessages(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  messageIds?: string[]
): Promise<void> {
  if (messageIds && messageIds.length > 0) {
    await supabase.from("pending_messages").delete().in("id", messageIds);
  } else {
    await supabase.from("pending_messages").delete().eq("phone_number", phone);
  }
  console.log(`[MessageGrouping] Mensagens pendentes deletadas`);
}

// Verifica se há mensagens pendentes
async function hasPendingMessages(
  supabase: ReturnType<typeof getSupabase>,
  phone: string
): Promise<boolean> {
  const { count } = await supabase
    .from("pending_messages")
    .select("id", { count: "exact", head: true })
    .eq("phone_number", phone);
  
  return (count ?? 0) > 0;
}

// ============ FUNÇÕES DE DIVISÃO DE RESPOSTAS LONGAS ============

// Configuração da divisão de mensagens
const MAX_MESSAGE_LENGTH = 1000; // Máximo de caracteres por mensagem
const SPLIT_PATTERNS = [
  /\n\n+/, // Parágrafos duplos
  /\n/, // Quebras de linha
  /(?<=[.!?])\s+/, // Fim de frases
  /(?<=[,;:])\s+/, // Vírgulas, ponto e vírgula
];

// Divide uma mensagem longa em partes menores
function splitLongMessage(message: string): string[] {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return [message];
  }
  
  const parts: string[] = [];
  let remaining = message;
  
  while (remaining.length > MAX_MESSAGE_LENGTH) {
    let splitIndex = MAX_MESSAGE_LENGTH;
    
    // Tenta encontrar um ponto de divisão natural
    for (const pattern of SPLIT_PATTERNS) {
      const substr = remaining.slice(0, MAX_MESSAGE_LENGTH);
      const matches = [...substr.matchAll(new RegExp(pattern, 'g'))];
      
      if (matches.length > 0) {
        // Pega a última ocorrência antes do limite
        const lastMatch = matches[matches.length - 1];
        if (lastMatch.index && lastMatch.index > MAX_MESSAGE_LENGTH / 2) {
          splitIndex = lastMatch.index + lastMatch[0].length;
          break;
        }
      }
    }
    
    parts.push(remaining.slice(0, splitIndex).trim());
    remaining = remaining.slice(splitIndex).trim();
  }
  
  if (remaining.length > 0) {
    parts.push(remaining);
  }
  
  console.log(`[MessageSplit] Mensagem dividida em ${parts.length} partes`);
  return parts;
}

// Envia resposta com divisão automática
async function sendLongTextResponse(phone: string, message: string): Promise<void> {
  const parts = splitLongMessage(message);
  
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) {
      await delay(600 + Math.random() * 400);
    }
    await sendWhatsAppMessage(phone, parts[i], true);
  }
}

// ============ FUNÇÕES DE RESUMO AUTOMÁTICO DE CONVERSA ============

// Configuração do resumo
const MESSAGES_BEFORE_SUMMARY = 10; // Quantidade de mensagens antes de criar resumo
const SUMMARY_TTL_HOURS = 2; // Tempo de validade do resumo

// Gera resumo da conversa usando IA
async function generateConversationSummary(
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string | null> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  const apiUrl = OPENROUTER_API_KEY 
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  
  const apiKey = OPENROUTER_API_KEY || LOVABLE_API_KEY;
  const model = OPENROUTER_API_KEY ? "deepseek/deepseek-chat" : "google/gemini-3-flash-preview";
  
  if (!apiKey) {
    return null;
  }
  
  const conversationText = conversationHistory
    .map(m => `${m.role === "user" ? "Cliente" : "Atendente"}: ${m.content}`)
    .join("\n");
  
  const systemPrompt = `Você é um assistente que cria resumos concisos de conversas de atendimento de uma lanchonete.

OBJETIVO: Criar um resumo MUITO BREVE (máximo 100 palavras) que capture:
1. O que o cliente pediu/quer
2. Dados coletados (nome, endereço, pagamento)
3. Status do pedido
4. Qualquer preferência ou observação importante

FORMATO: Texto corrido, objetivo, sem introduções.

Exemplo de resumo bom:
"Cliente João quer 2 X-Tudo e 1 Coca-Cola para entrega na Rua ABC 123. Pagamento via PIX. Pedido em andamento, aguardando confirmação."`;

  try {
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (OPENROUTER_API_KEY) {
      headers["HTTP-Referer"] = "https://lovable.dev";
      headers["X-Title"] = "WhatsApp Summary Bot";
    }
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Resuma esta conversa:\n\n${conversationText}` }
        ],
        temperature: 0.3,
        max_tokens: 200
      }),
    });
    
    if (!response.ok) {
      console.error("[Summary] Erro ao gerar resumo:", response.status);
      return null;
    }
    
    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content?.trim() || null;
    
    if (summary) {
      console.log(`[Summary] Resumo gerado: ${summary.slice(0, 100)}...`);
    }
    
    return summary;
  } catch (error) {
    console.error("[Summary] Erro ao gerar resumo:", error);
    return null;
  }
}

// Verifica se precisa criar/atualizar resumo
function shouldUpdateSummary(context: ConversationContext): boolean {
  const historyLength = context.conversationHistory?.length || 0;
  
  // Se não tem resumo e já tem mensagens suficientes
  if (!context.conversationSummary && historyLength >= MESSAGES_BEFORE_SUMMARY) {
    return true;
  }
  
  // Se tem resumo mas está expirado
  if (context.lastSummaryAt) {
    const summaryAge = Date.now() - new Date(context.lastSummaryAt).getTime();
    const summaryAgeHours = summaryAge / (1000 * 60 * 60);
    
    if (summaryAgeHours > SUMMARY_TTL_HOURS && historyLength >= MESSAGES_BEFORE_SUMMARY) {
      return true;
    }
  }
  
  // Se o histórico cresceu muito desde o último resumo
  if (context.conversationSummary && historyLength >= MESSAGES_BEFORE_SUMMARY * 2) {
    return true;
  }
  
  return false;
}

// Atualiza resumo e limpa histórico antigo
async function updateConversationSummary(context: ConversationContext): Promise<ConversationContext> {
  if (!context.conversationHistory || context.conversationHistory.length < MESSAGES_BEFORE_SUMMARY) {
    return context;
  }
  
  // Gera resumo das mensagens antigas
  const messagesToSummarize = context.conversationHistory.slice(0, -4); // Mantém as últimas 4
  const summary = await generateConversationSummary(messagesToSummarize);
  
  if (!summary) {
    return context;
  }
  
  // Combina resumo anterior com novo
  const combinedSummary = context.conversationSummary 
    ? `${context.conversationSummary}\n\nAtualização: ${summary}`
    : summary;
  
  // Limita tamanho do resumo combinado
  const finalSummary = combinedSummary.length > 500 
    ? combinedSummary.slice(-500) 
    : combinedSummary;
  
  return {
    ...context,
    conversationSummary: finalSummary,
    lastSummaryAt: new Date().toISOString(),
    // Mantém apenas as últimas 4 mensagens no histórico
    conversationHistory: context.conversationHistory.slice(-4)
  };
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

  // Voice ID: Ana Alice - Amigável e Clara (português brasileiro)
  const voiceId = "ORgG8rwdAiMYRug8RJwR";

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
    // Converte ArrayBuffer para base64 usando método seguro
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binary);

    console.log(`Enviando áudio TTS para ${phone}, tamanho: ${bytes.length} bytes`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionKey,
      },
      body: JSON.stringify({
        number: phone,
        // Evolution API espera URL ou BASE64 puro (sem data URI)
        audio: base64Audio,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro ao enviar áudio:", response.status, errorText);
      
      // Fallback: tenta endpoint alternativo
      const altUrl = `${evolutionUrl}/message/sendPtv/${instanceName}`;
      const altResponse = await fetch(altUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionKey,
        },
        body: JSON.stringify({
          number: phone,
          audio: base64Audio,
        }),
      });
      
      if (!altResponse.ok) {
        console.error("Fallback também falhou:", altResponse.status, await altResponse.text());
        return false;
      }
      
      console.log("Áudio enviado via endpoint alternativo");
      return true;
    }

    console.log("Áudio TTS enviado com sucesso");
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

// Interpreta pedido usando DeepSeek via OpenRouter
async function interpretVoiceOrder(
  transcript: string,
  products: Product[]
): Promise<{ items: Array<{ name: string; quantity: number; productId?: string; price?: number }>; understood: boolean }> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  
  // Fallback para Lovable AI se OpenRouter não estiver configurado
  if (!OPENROUTER_API_KEY) {
    console.log("OpenRouter não configurado, usando Lovable AI como fallback");
    return interpretVoiceOrderFallback(transcript, products);
  }

  const productList = products.map(p => `- ${p.name} (R$ ${p.price.toFixed(2)})`).join("\n");

  const systemPrompt = `Você é um assistente especializado em interpretar pedidos de uma lanchonete brasileira.

CARDÁPIO DISPONÍVEL:
${productList}

OBJETIVO: Extrair itens de pedido da mensagem do cliente com máxima precisão.

REGRAS DE INTERPRETAÇÃO:
1. Identifique produtos mesmo com variações de pronúncia, gírias ou erros de digitação
   - "x-tudo" = "X-Tudo"
   - "coca", "coquinha" = "Coca-Cola"
   - "refri" = qualquer refrigerante
   - "hamburguer", "lanche" = procure o mais similar no cardápio
2. Extraia quantidades (padrão: 1)
   - "dois", "2", "um par" = 2
   - "três", "3" = 3
3. Se o cliente mencionar algo que não existe, ignore esse item
4. Se a mensagem não contém pedido de produto, retorne items vazio

FORMATO DE RESPOSTA (JSON VÁLIDO):
{
  "items": [{"name": "Nome Exato do Cardápio", "quantity": 1}],
  "understood": true,
  "reasoning": "Breve explicação do que entendi"
}`;

  try {
    console.log(`[DeepSeek] Interpretando: "${transcript}"`);
    
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://lovable.dev",
        "X-Title": "WhatsApp Bot - Lanchonete"
      },
      body: JSON.stringify({
        model: "deepseek/deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Mensagem do cliente: "${transcript}"` }
        ],
        temperature: 0.2,
        max_tokens: 500
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro OpenRouter/DeepSeek:", response.status, errorText);
      // Fallback para Lovable AI
      return interpretVoiceOrderFallback(transcript, products);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    console.log(`[DeepSeek] Resposta: ${content}`);
    
    // Extrai JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (parsed.reasoning) {
        console.log(`[DeepSeek] Raciocínio: ${parsed.reasoning}`);
      }
      
      // Associa produtos reais aos itens identificados
      const itemsWithProducts = parsed.items.map((item: { name: string; quantity: number }) => {
        // Busca por correspondência mais flexível
        const matchedProduct = products.find(p => {
          const pName = p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const iName = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return pName.includes(iName) || iName.includes(pName) || 
                 pName.split(" ").some(word => iName.includes(word) && word.length > 3);
        });
        
        if (matchedProduct) {
          return {
            name: matchedProduct.name,
            quantity: item.quantity,
            productId: matchedProduct.id,
            price: matchedProduct.price
          };
        }
        return item;
      }).filter((item: { productId?: string }) => item.productId);
      
      return {
        items: itemsWithProducts,
        understood: parsed.understood && itemsWithProducts.length > 0
      };
    }
    
    return { items: [], understood: false };
  } catch (error) {
    console.error("Erro ao interpretar pedido com DeepSeek:", error);
    // Fallback para Lovable AI
    return interpretVoiceOrderFallback(transcript, products);
  }
}

// Fallback para Lovable AI caso OpenRouter falhe
async function interpretVoiceOrderFallback(
  transcript: string,
  products: Product[]
): Promise<{ items: Array<{ name: string; quantity: number; productId?: string; price?: number }>; understood: boolean }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  
  if (!LOVABLE_API_KEY) {
    console.error("LOVABLE_API_KEY não configurada");
    return { items: [], understood: false };
  }

  const productList = products.map(p => `- ${p.name} (R$ ${p.price.toFixed(2)})`).join("\n");

  const systemPrompt = `Você é um assistente de pedidos de uma lanchonete. Analise a mensagem do cliente e extraia os itens do pedido.

CARDÁPIO DISPONÍVEL:
${productList}

REGRAS:
1. Extraia apenas produtos que existem no cardápio
2. Identifique quantidades (padrão: 1)
3. Associe nomes falados aos produtos do cardápio

Responda APENAS com JSON:
{"items": [{"name": "Nome do Produto", "quantity": 1}], "understood": true}`;

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
          { role: "user", content: `Mensagem: "${transcript}"` }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error("Erro Lovable AI (fallback):", response.status, await response.text());
      return { items: [], understood: false };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
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
      }).filter((item: { productId?: string }) => item.productId);
      
      return {
        items: itemsWithProducts,
        understood: parsed.understood && itemsWithProducts.length > 0
      };
    }
    
    return { items: [], understood: false };
  } catch (error) {
    console.error("Erro ao interpretar pedido (fallback):", error);
    return { items: [], understood: false };
  }
}

// ============ ATENDENTE IA COM DEEPSEEK ============

// Prompt de sistema do atendente virtual
function getAttendantSystemPrompt(products: Product[], context: ConversationContext, inputType: "text" | "audio"): string {
  const productList = products.map(p => `- ${p.name}: R$ ${p.price.toFixed(2)}${p.description ? ` (${p.description})` : ""}`).join("\n");
  
  // Garante que cart seja sempre um array válido
  const cart = Array.isArray(context?.cart) ? context.cart : [];
  
  const cartSummary = cart.length > 0
    ? cart.map(item => `${item.quantity}x ${item.productName} - R$ ${(item.price * item.quantity).toFixed(2)}`).join("\n")
    : "Vazio";
  
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = context?.orderType === "DELIVERY" ? 5 : 0;

  // Determina qual dado está faltando para guiar a conversa
  const missingData: string[] = [];
  if (cart.length === 0) missingData.push("ITENS DO PEDIDO");
  if (!isValidCustomerName(context?.customerName)) missingData.push("NOME");
  if (!context?.orderType) missingData.push("TIPO (entrega ou retirada)");
  if (context?.orderType === "DELIVERY" && !context?.deliveryAddress) missingData.push("ENDEREÇO");
  if (!context?.paymentMethod) missingData.push("PAGAMENTO");
  
  const missingDataInfo = missingData.length > 0 
    ? `DADOS QUE AINDA FALTAM: ${missingData.join(", ")}`
    : "TODOS OS DADOS COLETADOS - pode usar confirm_order";

  // Inclui resumo da conversa se disponível
  const conversationSummarySection = context?.conversationSummary 
    ? `────────────────────────
RESUMO DA CONVERSA ANTERIOR
────────────────────────
${context.conversationSummary}

` : "";

  return `Você é um atendente virtual simpático de uma lanchonete.

Use linguagem humana, natural, direta e amigável.

${conversationSummarySection}────────────────────────
NÚCLEO DE ESTILO (OBRIGATÓRIO)
────────────────────────
- Respostas curtas, diretas e sem redundância
- Não repita informações já claras no estado do pedido
- Não explique regras internas ao cliente
- Faça apenas UMA pergunta por vez
- Não use introduções longas nem despedidas
- Nunca invente produtos, preços ou promoções
- Nunca confirme ou registre pedidos (exceto no modo REVISÃO)

────────────────────────
CANAL DE ENTRADA
────────────────────────
- Mensagem recebida via: ${inputType.toUpperCase()}

────────────────────────
REGRAS POR CANAL
────────────────────────
▶ WHATSAPP (texto)
- Responda em 1 ou 2 frases curtas
- Sem floreios, sem justificativas extras
- Se precisar pedir algo, faça só a pergunta
- Evite listas longas (máx. 3 opções)

▶ URA / ÁUDIO
- Frases curtas, com ritmo de fala
- No máximo 12 a 15 palavras por frase
- Use pontuação para pausas naturais
- Termine sempre com UMA pergunta clara

▶ TTS NEURAL (pronúncia)
- Não use símbolos: evite "R$", "%", "+", "x"
- Valores em reais por extenso:
  - 5,00 → "cinco reais"
  - 12,50 → "doze reais e cinquenta centavos"
- Quantidades por extenso quando faladas
- Use "píx", "cartão", "dinheiro"
- Evite abreviações: diga "rua", "avenida", "número"

────────────────────────
⚠️ REGRA CRÍTICA — CONFIRMAÇÃO DE PEDIDO
────────────────────────
- VOCÊ NÃO CONFIRMA PEDIDOS
- NÃO diga:
  "pedido confirmado", "pedido criado", "anotei", "já registrei"
- A confirmação real vem SOMENTE do sistema
- Se o cliente pedir confirmação e faltar dado:
  → pergunte o dado faltante
- ${missingDataInfo}
- Se o cliente insistir sem fornecer dados:
  → ofereça a opção "REVISAR"

────────────────────────
CARDÁPIO DISPONÍVEL
────────────────────────
${productList}

Use APENAS os itens do cardápio.

────────────────────────
ESTADO ATUAL DO PEDIDO
────────────────────────
- Itens: ${cartSummary}
- Total: R$ ${cartTotal.toFixed(2)}
- Nome: ${context.customerName || "Não informado"}
- Tipo: ${
  context.orderType === "DELIVERY"
    ? "Entrega (cinco reais)"
    : context.orderType === "PRESENCIAL"
    ? "Retirada"
    : "Não definido"
}
- Endereço: ${context.deliveryAddress || "Não informado"}
- Pagamento: ${context.paymentMethod || "Não definido"}
${context.changeFor ? `- Troco para: R$ ${context.changeFor.toFixed(2)}` : ""}

────────────────────────
FORMAS DE PAGAMENTO
────────────────────────
PIX, Cartão ou Dinheiro

────────────────────────
FLUXO OBRIGATÓRIO DE ATENDIMENTO
────────────────────────
1. Cliente mencionar produtos
   → use action: add_to_cart
2. Após adicionar
   → pergunte se deseja mais algo
3. Cliente finalizar
   → pergunte entrega ou retirada
   → use action: set_delivery ou set_pickup
4. Se entrega
   → peça o endereço
   → use action: set_address
5. Pergunte a forma de pagamento
   → use action: set_payment
6. Pergunte o nome do cliente
   → use action: set_name
7. SOMENTE com TODOS os dados completos
   → use action: confirm_order

────────────────────────
PRÓXIMO PASSO RECOMENDADO
────────────────────────
${missingData.length > 0
  ? `Pergunte: ${missingData[0]}`
  : "Pode confirmar o pedido usando confirm_order"
}

────────────────────────
REGRAS PARA USAR confirm_order
────────────────────────
- Nunca use se o carrinho estiver vazio
- Nunca use sem:
  itens + tipo + pagamento + nome
- Se faltar algo:
  → NÃO confirme
  → pergunte o dado faltante
- Ao usar confirm_order, envie TODOS os dados:
  - items [{ name, quantity }]
  - name
  - delivery_type: DELIVERY ou PRESENCIAL
  - address (se entrega)
  - payment

────────────────────────
MODO REVISÃO (ATENDIMENTO HUMANO)
────────────────────────
Se o cliente disser:
"REVISAR", "REVISÃO", "ATENDENTE", "HUMANO", "FALAR COM ALGUÉM"
→ use action: request_review

Informe de forma curta que o pedido foi enviado
para conferência manual e um atendente irá verificar.

────────────────────────
PRODUTO INEXISTENTE
────────────────────────
- Peça desculpas de forma leve
- Sugira 2 ou 3 opções do cardápio

────────────────────────
ANTI-VERBOSIDADE (OBRIGATÓRIO)
────────────────────────
- Use apenas UMA expressão de confirmação ("certo" OU "beleza")
- Não repita carrinho ou total sem o cliente pedir
- Não faça mais de 1 frase antes da pergunta
- Não repita perguntas já feitas

────────────────────────
FORMATO DE RESPOSTA (OBRIGATÓRIO)
────────────────────────
Responda SEMPRE em JSON:
{
  "text_reply": "Resposta curta, direta e sem redundância",
  "voice_reply_script": "Texto natural para narração, sem símbolos",
  "action": "none | add_to_cart | remove_from_cart | set_delivery | set_pickup | set_address | set_payment | set_name | set_change | confirm_order | request_review | check_status",
  "action_data": {
    "items": [{ "name": "Nome Exato do Produto", "quantity": 1 }],
    "name": "Nome do cliente",
    "delivery_type": "DELIVERY ou PRESENCIAL",
    "address": "Endereço completo (se entrega)",
    "payment": "PIX | CARTAO | DINHEIRO",
    "change_for": 50
  }
}`;
}

type ConfirmOrderBlockReason =
  | "missing_items"
  | "missing_name"
  | "missing_order_type"
  | "missing_address"
  | "missing_payment"
  | "create_failed"
  | "sent_to_review"; // Pedido foi registrado como revisão

type AIActionResult = {
  newContext: ConversationContext;
  orderNumber?: number;
  confirmOrderBlocked?: ConfirmOrderBlockReason;
  sentToReview?: boolean; // Flag indicando que foi para revisão
};

function isValidCustomerName(name: unknown): name is string {
  if (typeof name !== "string") return false;
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (cleaned.length < 2) return false;
  
  // Nomes inválidos explícitos
  const invalidExact = [
    "nao informado",
    "não informado",
    "sem nome",
    "cliente",
    "anonimo",
    "anônimo",
    "nao sei",
    "pendente",
    "pendente - revisao",
  ];
  if (invalidExact.includes(cleaned)) return false;
  
  // Padrões que indicam que é uma frase, não um nome
  const invalidPatterns = [
    /\b(oi|ola|bom dia|boa tarde|boa noite)\b/,
    /\b(gostaria|quero|queria|preciso|pedido|pedir)\b/,
    /\b(fazer|enviar|mandar|trazer)\b/,
    /\b(cardapio|menu|produtos|opcoes)\b/,
    /\b(entrega|delivery|retirada|buscar)\b/,
    /\b(pix|cartao|dinheiro|pagamento)\b/,
    /\b(rua|avenida|endereco|bairro|numero)\b/,
    /[?!]/,  // Frases com pontuação de pergunta/exclamação
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(cleaned)) return false;
  }
  
  // Nomes muito longos provavelmente são frases
  if (cleaned.length > 50) return false;
  
  // Nomes com muitas palavras provavelmente são frases (mais de 4 palavras)
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 4) return false;
  
  return true;
}

// Sanitiza o nome do cliente para exibição/áudio
function sanitizeCustomerName(name: string | null | undefined): string | null {
  if (!name) return null;
  if (!isValidCustomerName(name)) return null;
  
  // Remove caracteres especiais e limpa o nome
  return name.trim().replace(/[^\p{L}\s]/gu, "").trim() || null;
}

function getConfirmOrderBlockReason(context: ConversationContext): ConfirmOrderBlockReason | null {
  if (!context?.cart || context.cart.length === 0) return "missing_items";
  if (!isValidCustomerName(context.customerName)) return "missing_name";
  if (!context.orderType) return "missing_order_type";
  if (context.orderType === "DELIVERY" && !context.deliveryAddress) return "missing_address";
  if (!context.paymentMethod) return "missing_payment";
  return null;
}

function getMissingDataQuestion(reason: ConfirmOrderBlockReason): { text: string; voice: string } {
  switch (reason) {
    case "missing_items":
      return {
        text: "Antes de confirmar, me diz quais itens você quer no pedido (ex.: 1 X-Tudo e 1 Coca-Cola Lata).",
        voice: "Antes de confirmar, me diz quais itens você quer no pedido. Por exemplo: um X-Tudo e uma Coca-Cola lata.",
      };
    case "missing_name":
      return {
        text: "Show! Pra confirmar, me diz seu nome.",
        voice: "Show! Pra eu confirmar o pedido, me diz seu nome.",
      };
    case "missing_order_type":
      return {
        text: "Vai ser entrega ou retirada?",
        voice: "Vai ser entrega ou retirada?",
      };
    case "missing_address":
      return {
        text: "Perfeito. Me passa seu endereço completo, por favor (rua, número, bairro).",
        voice: "Perfeito. Me passa seu endereço completo, por favor. Rua, número e bairro.",
      };
    case "missing_payment":
      return {
        text: "Como você prefere pagar: Pix, cartão ou dinheiro?",
        voice: "Como você prefere pagar: Pix, cartão ou dinheiro?",
      };
    default:
      return {
        text: "Só um instante — preciso de mais uma informação pra registrar seu pedido.",
        voice: "Só um instante. Eu preciso de mais uma informação pra registrar seu pedido.",
      };
  }
}

// Processa mensagem com IA (DeepSeek)
async function processWithAI(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  message: string,
  inputType: "text" | "audio",
  context: ConversationContext
): Promise<{
  textReply: string;
  voiceReply?: string;
  newContext: ConversationContext;
  shouldSendVoice: boolean;
}> {
  const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const products = await getAllProducts(supabase);
  
  let newContext = { ...context };
  
  // Inicializa histórico se não existir
  if (!newContext.conversationHistory) {
    newContext.conversationHistory = [];
  }

  const lastAssistantBefore = [...newContext.conversationHistory]
    .reverse()
    .find((m) => m.role === "assistant")?.content;

  // Heurística importante: se o cliente respondeu "não" após "mais alguma coisa?",
  // isso significa "não quero mais itens" -> seguir para finalizar, e NÃO pedir itens novamente.
  const userIntent = detectIntent(message).intent;
  const denyMeansFinish =
    userIntent === "deny" &&
    Array.isArray(newContext.cart) &&
    newContext.cart.length > 0 &&
    isLikelyMoreItemsQuestion(lastAssistantBefore);
  
  // Adiciona mensagem do usuário ao histórico
  newContext.conversationHistory.push({
    role: "user",
    content: message,
    inputType
  });
  
  // Limita histórico a últimas 10 mensagens
  if (newContext.conversationHistory.length > 20) {
    newContext.conversationHistory = newContext.conversationHistory.slice(-20);
  }
  
  const systemPrompt = getAttendantSystemPrompt(products, newContext, inputType);
  
  // Monta mensagens para a IA
  const aiMessages = [
    { role: "system", content: systemPrompt },
    ...newContext.conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ];

  if (denyMeansFinish) {
    aiMessages.push({
      role: "system",
      content:
        'NOTA DO SISTEMA: O cliente respondeu "NÃO" para "mais alguma coisa?". Interprete isso como intenção de FINALIZAR o pedido (seguir para coleta de dados de checkout), e NÃO como carrinho vazio.'
    });
  }

  const inferredUserItems = inferCartItemsFromMessage(message, products);
  
  // Usa OpenRouter/DeepSeek se disponível, senão Lovable AI
  const apiUrl = OPENROUTER_API_KEY 
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  
  const apiKey = OPENROUTER_API_KEY || Deno.env.get("LOVABLE_API_KEY");
  const model = OPENROUTER_API_KEY ? "deepseek/deepseek-chat" : "google/gemini-3-flash-preview";
  
  if (!apiKey) {
    console.error("Nenhuma API key configurada para IA");
    return {
      textReply: "Desculpe, estou com um probleminha técnico. Pode tentar de novo?",
      newContext,
      shouldSendVoice: inputType === "audio"
    };
  }

  try {
    console.log(`[AI] Processando com ${OPENROUTER_API_KEY ? "DeepSeek" : "Lovable AI"}: "${message}" (${inputType})`);
    
    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    
    if (OPENROUTER_API_KEY) {
      headers["HTTP-Referer"] = "https://lovable.dev";
      headers["X-Title"] = "WhatsApp Lanchonete Bot";
    }
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: aiMessages,
        temperature: 0.4,
        max_tokens: 800
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro AI:", response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";
    
    console.log(`[AI] Resposta: ${content.slice(0, 200)}...`);
    
    // Tenta extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);

        let textReply: string = parsed.text_reply || "Como posso ajudar?";
        let voiceReply: string = parsed.voice_reply_script || textReply;

        const missingBefore = getConfirmOrderBlockReason(newContext);

        const cartLenBeforeActions = newContext.cart?.length || 0;

        // Variáveis para rastrear resultado de ações
        let actionOrderNumber: number | undefined;
        let actionSentToReview = false;

        // Processa ações
        if (parsed.action && parsed.action !== "none") {
          const actionResult = await processAIAction(
            supabase,
            phone,
            parsed.action,
            parsed.action_data || {},
            newContext,
            products,
            inputType
          );

          newContext = actionResult.newContext;
          actionOrderNumber = actionResult.orderNumber;
          actionSentToReview = actionResult.sentToReview || false;

          // Se a IA tentou confirmar, mas o backend bloqueou (faltou dado / carrinho vazio),
          // sobrescreve a resposta para não mentir que confirmou.
          if (parsed.action === "confirm_order") {
            if (actionResult.sentToReview && actionResult.orderNumber) {
              // Pedido foi para revisão
              textReply = `📋 Seu pedido foi registrado como #${actionResult.orderNumber} e está *EM REVISÃO*. Um atendente vai conferir e entrar em contato se precisar de mais informações!`;
              voiceReply = `Seu pedido foi registrado com número ${actionResult.orderNumber} e está em revisão. Um atendente vai conferir e entrar em contato se precisar de mais informações!`;
            } else if (actionResult.orderNumber) {
              textReply = `✅ Pedido confirmado! Número #${actionResult.orderNumber}. Vou te atualizando por aqui.`;
              voiceReply = `Perfeito! Seu pedido ficou confirmado. Número ${actionResult.orderNumber}. Vou te atualizando por aqui.`;
            } else if (actionResult.confirmOrderBlocked) {
              const blocked = actionResult.confirmOrderBlocked;
              if (blocked === "missing_items") {
                textReply = "Antes de confirmar, me diz quais itens você quer no pedido (ex.: 1 X-Tudo e 1 Coca-Cola Lata).";
                voiceReply = "Antes de confirmar, me diz quais itens você quer no pedido. Por exemplo: um X-Tudo e uma Coca-Cola lata.";
              } else if (blocked === "missing_name") {
                textReply = "Show! Pra confirmar, me diz seu nome. Ou diga *REVISAR* pra gente registrar e conferir depois.";
                voiceReply = "Show! Pra eu confirmar o pedido, me diz seu nome. Ou fale revisar pra gente registrar e conferir depois.";
              } else if (blocked === "missing_order_type") {
                textReply = "Vai ser entrega ou retirada? Ou diga *REVISAR* pra gente registrar e conferir depois.";
                voiceReply = "Vai ser entrega ou retirada? Ou fale revisar pra gente registrar e conferir depois.";
              } else if (blocked === "missing_address") {
                textReply = "Perfeito. Me passa seu endereço completo, por favor (rua, número, bairro). Ou diga *REVISAR* pra gente registrar e conferir depois.";
                voiceReply = "Perfeito. Me passa seu endereço completo. Ou fale revisar pra gente registrar e conferir depois.";
              } else if (blocked === "missing_payment") {
                textReply = "Como você prefere pagar: Pix, cartão ou dinheiro? Ou diga *REVISAR* pra gente registrar e conferir depois.";
                voiceReply = "Como você prefere pagar: Pix, cartão ou dinheiro? Ou fale revisar pra gente registrar e conferir depois.";
              } else if (blocked === "sent_to_review") {
                // Já tratado acima
              } else {
                textReply = "Tive um probleminha pra confirmar seu pedido agora. Pode tentar de novo ou dizer *REVISAR*?";
                voiceReply = "Tive um probleminha pra confirmar seu pedido agora. Pode tentar de novo ou dizer revisar?";
              }
            }
          }

          // Trata ação de request_review
          if (parsed.action === "request_review" && actionResult.orderNumber) {
            textReply = `📋 Seu pedido foi registrado como #${actionResult.orderNumber} e está *EM REVISÃO*. Um atendente vai conferir e entrar em contato!`;
            voiceReply = `Seu pedido foi registrado com número ${actionResult.orderNumber} e está em revisão. Um atendente vai conferir e entrar em contato!`;
          }
        }

        // Se a IA NÃO chamou add_to_cart, mas o usuário claramente digitou um item (ex.: "X-Tudo"),
        // inferimos e adicionamos para evitar o loop de "me diz quais itens".
        if (
          inferredUserItems.length > 0 &&
          parsed.action !== "add_to_cart" &&
          parsed.action !== "confirm_order" &&
          (newContext.cart?.length || 0) === cartLenBeforeActions
        ) {
          const changed = mergeItemsIntoCart(newContext, inferredUserItems);
          if (changed) {
            console.log("[Heurística] Itens inferidos e adicionados ao carrinho a partir da mensagem do cliente.");
          }
        }

        const missingAfter = getConfirmOrderBlockReason(newContext);

        // AUTO-CONFIRMAÇÃO: se o cliente acabou de fornecer o último dado necessário,
        // garante que o pedido seja realmente criado no banco antes de falar "confirmado".
        if (!actionOrderNumber && !actionSentToReview && !missingAfter) {
          const userWantsFinalize = /\b(confirmar|confirmo|finalizar|finalizo|fechar|fecha|pode\s+confirmar|pode\s+fechar|isso\s+mesmo)\b/i.test(message);
          const actionLikelyLastStep =
            ["set_name", "set_payment", "set_address", "set_delivery", "set_pickup", "set_change"].includes(parsed.action || "");

          if (userWantsFinalize || (missingBefore && actionLikelyLastStep)) {
            const autoConfirm = await processAIAction(
              supabase,
              phone,
              "confirm_order",
              {
                items: newContext.cart?.map((i) => ({ name: i.productName, quantity: i.quantity })) || [],
                name: newContext.customerName,
                delivery_type: newContext.orderType,
                address: newContext.deliveryAddress,
                payment: newContext.paymentMethod,
                change_for: newContext.changeFor,
              },
              newContext,
              products,
              inputType
            );

            newContext = autoConfirm.newContext;
            actionOrderNumber = autoConfirm.orderNumber;
            actionSentToReview = autoConfirm.sentToReview || false;

            if (actionSentToReview && actionOrderNumber) {
              textReply = `📋 Seu pedido foi registrado como #${actionOrderNumber} e está *EM REVISÃO*. Um atendente vai conferir e entrar em contato se precisar de mais informações!`;
              voiceReply = `Seu pedido foi registrado com número ${actionOrderNumber} e está em revisão. Um atendente vai conferir e entrar em contato se precisar de mais informações!`;
            } else if (actionOrderNumber) {
              textReply = `✅ Pedido confirmado! Número #${actionOrderNumber}. Vou te atualizando por aqui.`;
              voiceReply = `Perfeito! Seu pedido ficou confirmado. Número ${actionOrderNumber}. Vou te atualizando por aqui.`;
            } else if (autoConfirm.confirmOrderBlocked) {
              const q = getMissingDataQuestion(autoConfirm.confirmOrderBlocked);
              textReply = q.text;
              voiceReply = q.voice;
            } else {
              textReply = "Tive um probleminha pra registrar seu pedido agora. Pode tentar de novo?";
              voiceReply = "Tive um probleminha pra registrar seu pedido agora. Pode tentar de novo?";
            }
          }
        }

        // Guardrail FORTE: nunca afirmar "pedido confirmado" sem ter executado confirm_order com sucesso.
        // Isso evita que o cliente ouça uma confirmação que não virou pedido no sistema.
        const confirmPatterns = [
          /pedido\s+(?:ja\s+|foi\s+)?confirmad[oa]/i,
          /pedido\s+(?:ja\s+|foi\s+)?criad[oa]/i,
          /pedido\s+(?:ja\s+|foi\s+)?registrad[oa]/i,
          /anotei\s+(?:o\s+)?seu\s+pedido/i,
          /seu\s+pedido\s+(?:ja\s+)?(?:foi|esta|está)\s+(?:confirm|anot|registr)/i,
          /pronto[\!,\.]?\s*seu\s+pedido/i,
          /pedido\s+(?:n[úu]mero\s+)?#?\d+\s+confirmad/i,
        ];
        const customerVisibleReply = inputType === "audio" ? voiceReply : textReply;
        const saidConfirmed = confirmPatterns.some(
          (pattern) =>
            pattern.test(textReply) ||
            pattern.test(voiceReply) ||
            pattern.test(customerVisibleReply)
        );
        
        // Só permite confirmação se EXISTE orderNumber criado no banco
        const wasRealConfirmation = Boolean(actionOrderNumber) && !actionSentToReview;
        const wasReviewConfirmation = Boolean(actionOrderNumber) && actionSentToReview;
        
        if (saidConfirmed && !wasRealConfirmation && !wasReviewConfirmation) {
          // A IA disse que confirmou mas não confirmou de verdade - corrige a resposta
          console.log("[Guardrail] IA disse confirmado sem criar pedido real. Corrigindo resposta.");
          const missingNow = getConfirmOrderBlockReason(newContext);
          if (missingNow) {
            const q = getMissingDataQuestion(missingNow);
            textReply = q.text;
            voiceReply = q.voice;
          } else {
            textReply = "Ainda não consegui registrar seu pedido no sistema. Pode falar 'finalizar' de novo?";
            voiceReply = "Ainda não consegui registrar seu pedido no sistema. Pode falar finalizar de novo?";
          }
        }
        
        // Adiciona resposta ao histórico
        newContext.conversationHistory?.push({
          role: "assistant",
          content: textReply,
          inputType
        });
        
        return {
          textReply,
          voiceReply: inputType === "audio" ? voiceReply : undefined,
          newContext,
          shouldSendVoice: inputType === "audio"
        };
      } catch (parseError) {
        console.error("Erro ao parsear JSON da IA:", parseError);
      }
    }

    // Fallback: IA não devolveu JSON confiável.
    // Regra de segurança: nunca deixar sair "pedido confirmado" sem criar pedido no banco.
    const fallbackRaw = content.replace(/```json[\s\S]*?```/g, "").trim() || "";
    const fallbackConfirmPatterns = [
      /pedido\s+(?:ja\s+|foi\s+)?confirmad[oa]/i,
      /pedido\s+(?:ja\s+|foi\s+)?criad[oa]/i,
      /pedido\s+(?:ja\s+|foi\s+)?registrad[oa]/i,
      /anotei\s+(?:o\s+)?seu\s+pedido/i,
      /seu\s+pedido\s+(?:ja\s+)?(?:foi|esta|está)\s+(?:confirm|anot|registr)/i,
    ];
    const saidConfirmed = fallbackConfirmPatterns.some((p) => p.test(fallbackRaw));

    // Tenta extrair dados básicos do próprio texto do cliente (nome/pagamento/tipo/endereço)
    const missingBeforeFallback = getConfirmOrderBlockReason(newContext);
    applyDeterministicCheckoutExtraction(message, newContext);

    // Também tenta inferir itens a partir da mensagem do cliente se estiver faltando itens
    if ((missingBeforeFallback === "missing_items" || (newContext.cart?.length || 0) === 0) && inferredUserItems.length > 0) {
      mergeItemsIntoCart(newContext, inferredUserItems);
    }

    const missingAfterFallback = getConfirmOrderBlockReason(newContext);

    const userWantsFinalizeFallback =
      denyMeansFinish ||
      /\b(confirmar|confirmo|finalizar|finalizo|fechar|fecha|pode\s+confirmar|pode\s+fechar|isso\s+mesmo)\b/i.test(message);
    const completedNow = Boolean(missingBeforeFallback) && !missingAfterFallback;

    let safeReply = fallbackRaw || "Como posso ajudar?";

    // Se completou o último dado agora OU a IA tentou confirmar sem JSON, tenta confirmar de verdade.
    if (!missingAfterFallback && (completedNow || userWantsFinalizeFallback || saidConfirmed)) {
      const autoConfirm = await processAIAction(
        supabase,
        phone,
        "confirm_order",
        {
          items: newContext.cart?.map((i) => ({ name: i.productName, quantity: i.quantity })) || [],
          name: newContext.customerName,
          delivery_type: newContext.orderType,
          address: newContext.deliveryAddress,
          payment: newContext.paymentMethod,
          change_for: newContext.changeFor,
        },
        newContext,
        products,
        inputType
      );

      newContext = autoConfirm.newContext;

      if (autoConfirm.sentToReview && autoConfirm.orderNumber) {
        safeReply = `📋 Seu pedido foi registrado como #${autoConfirm.orderNumber} e está *EM REVISÃO*. Um atendente vai conferir e entrar em contato se precisar de mais informações!`;
      } else if (autoConfirm.orderNumber) {
        safeReply = `✅ Pedido confirmado! Número #${autoConfirm.orderNumber}. Vou te atualizando por aqui.`;
      } else if (autoConfirm.confirmOrderBlocked) {
        const q = getMissingDataQuestion(autoConfirm.confirmOrderBlocked);
        safeReply = q.text;
      } else {
        safeReply = "Ainda não consegui registrar seu pedido no sistema. Pode falar 'finalizar' de novo?";
      }
    } else if (saidConfirmed && missingAfterFallback) {
      // IA disse "confirmado" mas falta dado -> não pode confirmar
      const q = getMissingDataQuestion(missingAfterFallback);
      safeReply = q.text;
    }

    newContext.conversationHistory?.push({
      role: "assistant",
      content: safeReply,
      inputType
    });

    return {
      textReply: safeReply,
      voiceReply: inputType === "audio" ? safeReply : undefined,
      newContext,
      shouldSendVoice: inputType === "audio"
    };
    
  } catch (error) {
    console.error("Erro ao processar com IA:", error);
    return {
      textReply: "Desculpe, tive um probleminha. Pode repetir?",
      newContext,
      shouldSendVoice: inputType === "audio"
    };
  }
}

// Processa ações retornadas pela IA
async function processAIAction(
  supabase: ReturnType<typeof getSupabase>,
  phone: string,
  action: string,
  actionData: any,
  context: ConversationContext,
  products: Product[],
  inputType: "text" | "audio" = "text"
): Promise<AIActionResult> {
  let newContext = { ...context };
  // Garante que cart seja sempre um array válido
  if (!Array.isArray(newContext.cart)) {
    newContext.cart = [];
  }
  let orderNumber: number | undefined;
  let confirmOrderBlocked: ConfirmOrderBlockReason | undefined;
  let sentToReview = false;
  
  console.log(`[AI Action] ${action}:`, JSON.stringify(actionData));
  
  switch (action) {
    case "add_to_cart":
      if (actionData.items && Array.isArray(actionData.items)) {
        for (const item of actionData.items) {
          const product = products.find(p => 
            p.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(p.name.toLowerCase())
          );
          
          if (product) {
            const existingItem = newContext.cart.find(c => c.productId === product.id);
            if (existingItem) {
              existingItem.quantity += item.quantity || 1;
            } else {
              newContext.cart.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity || 1,
                price: product.price
              });
            }
            console.log(`[AI Action] Adicionado: ${item.quantity || 1}x ${product.name}`);
          }
        }
      }
      break;
      
    case "remove_from_cart":
      if (actionData.items && Array.isArray(actionData.items)) {
        for (const item of actionData.items) {
          const idx = newContext.cart.findIndex(c => 
            c.productName.toLowerCase().includes(item.name.toLowerCase())
          );
          if (idx >= 0) {
            newContext.cart.splice(idx, 1);
            console.log(`[AI Action] Removido: ${item.name}`);
          }
        }
      }
      break;
      
    case "set_delivery":
      newContext.orderType = "DELIVERY";
      break;
      
    case "set_pickup":
      newContext.orderType = "PRESENCIAL";
      break;
      
    case "set_address":
      if (actionData.address) {
        newContext.deliveryAddress = actionData.address;
      }
      break;
      
    case "set_name":
      if (actionData.name) {
        newContext.customerName = actionData.name;
      }
      break;
      
    case "set_payment":
      if (actionData.payment) {
        const paymentMap: Record<string, "PIX" | "CARTAO" | "DINHEIRO"> = {
          "pix": "PIX",
          "cartao": "CARTAO",
          "cartão": "CARTAO",
          "dinheiro": "DINHEIRO",
        };
        newContext.paymentMethod = paymentMap[actionData.payment.toLowerCase()] || actionData.payment;
      }
      break;
      
    case "set_change":
      if (actionData.change_for) {
        newContext.changeFor = actionData.change_for;
      }
      break;
      
    case "confirm_order":
      // Valida que temos dados suficientes para criar o pedido
      console.log(`[AI Action] confirm_order - Carrinho: ${newContext.cart.length} itens, Nome: ${newContext.customerName}, Tipo: ${newContext.orderType}, Pagamento: ${newContext.paymentMethod}, Tentativas: ${newContext.confirmAttempts || 0}`);
      
      // Se action_data tiver itens, adiciona ao carrinho primeiro
      if (actionData.items && Array.isArray(actionData.items) && actionData.items.length > 0) {
        // Regra: NÃO sobrescrever carrinho existente com lista parcial.
        // - Se carrinho estiver vazio: usa action_data.items como fonte
        // - Se carrinho já tiver itens: apenas faz merge (não remove nada)
        const shouldReplace = newContext.cart.length === 0;
        if (shouldReplace) newContext.cart = [];

        for (const item of actionData.items) {
          if (!item?.name) continue;
          const itemName = String(item.name);
          const qty = Number(item.quantity || 1);
          const product = products.find(
            (p) =>
              p.name.toLowerCase().includes(itemName.toLowerCase()) ||
              itemName.toLowerCase().includes(p.name.toLowerCase())
          );

          if (!product) continue;

          const existing = newContext.cart.find((c) => c.productId === product.id);
          if (existing) {
            // Se estamos substituindo, soma; se estamos mesclando, soma também (não atrapalha)
            existing.quantity += qty;
          } else {
            newContext.cart.push({
              productId: product.id,
              productName: product.name,
              quantity: qty,
              price: product.price,
            });
          }
          console.log(`[AI Action] Item ${shouldReplace ? "definido" : "mesclado"} via confirm: ${qty}x ${product.name}`);
        }
      }
      
      // Atualiza dados do contexto se vieram no action_data
      if (isValidCustomerName(actionData.name)) {
        newContext.customerName = actionData.name.trim();
      }
      if (actionData.delivery_type) {
        newContext.orderType = actionData.delivery_type === "DELIVERY" ? "DELIVERY" : "PRESENCIAL";
      }
      if (actionData.address) {
        newContext.deliveryAddress = actionData.address;
      }
      if (actionData.payment) {
        const paymentMap: Record<string, "PIX" | "CARTAO" | "DINHEIRO"> = {
          "pix": "PIX", "PIX": "PIX",
          "cartao": "CARTAO", "cartão": "CARTAO", "CARTAO": "CARTAO",
          "dinheiro": "DINHEIRO", "DINHEIRO": "DINHEIRO",
        };
        const key = String(actionData.payment).toLowerCase().trim();
        newContext.paymentMethod = paymentMap[key] || paymentMap[String(actionData.payment)] || actionData.payment;
      }
      
      // Verifica dados faltantes
      const hasMissingData = 
        newContext.cart.length === 0 ||
        !isValidCustomerName(newContext.customerName) ||
        !newContext.orderType ||
        (newContext.orderType === "DELIVERY" && !newContext.deliveryAddress) ||
        !newContext.paymentMethod;
      
      // Se tem dados faltantes, incrementa contador de tentativas
      if (hasMissingData) {
        newContext.confirmAttempts = (newContext.confirmAttempts || 0) + 1;
        console.log(`[AI Action] Dados faltantes, tentativa ${newContext.confirmAttempts}`);
        
        // AUTO-REVISÃO: Se já tentou 2+ vezes E tem pelo menos itens no carrinho, registra como revisão
        if (newContext.confirmAttempts >= 2 && newContext.cart.length > 0) {
          console.log("[AI Action] Auto-revisão ativada: registrando pedido incompleto para revisão");
          orderNumber = (await createOrder(supabase, newContext, phone, inputType, true)) ?? undefined;
          if (orderNumber) {
            sentToReview = true;
            confirmOrderBlocked = "sent_to_review";
            console.log(`[AI Action] Pedido #${orderNumber} criado como REVISÃO`);
            // Limpa contexto
            newContext = { 
              cart: [],
              conversationHistory: newContext.conversationHistory 
            };
          }
          break;
        }
        
        // Ainda não atingiu limite, retorna o erro específico
        if (newContext.cart.length === 0) {
          confirmOrderBlocked = "missing_items";
        } else if (!isValidCustomerName(newContext.customerName)) {
          confirmOrderBlocked = "missing_name";
        } else if (!newContext.orderType) {
          confirmOrderBlocked = "missing_order_type";
        } else if (newContext.orderType === "DELIVERY" && !newContext.deliveryAddress) {
          confirmOrderBlocked = "missing_address";
        } else if (!newContext.paymentMethod) {
          confirmOrderBlocked = "missing_payment";
        }
        break;
      }
      
      // Cria o pedido no banco (todos os dados OK)
      orderNumber = (await createOrder(supabase, newContext, phone, inputType, false)) ?? undefined;
      if (orderNumber) {
        console.log(`[AI Action] Pedido criado com sucesso: #${orderNumber}`);
        console.log(`[AI Action] Itens: ${newContext.cart.map(i => `${i.quantity}x ${i.productName}`).join(", ")}`);
        console.log(`[AI Action] Total: R$ ${newContext.cart.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}`);
        
        // Limpa contexto após pedido confirmado
        newContext = { 
          cart: [],
          conversationHistory: newContext.conversationHistory 
        };
      } else {
        console.error("[AI Action] ERRO: Falha ao criar pedido no banco!");
        confirmOrderBlocked = "create_failed";
      }
      break;
    
    // NOVA AÇÃO: Solicitar revisão manualmente
    case "request_review":
      // IMPORTANTE: Extrai e aplica dados do actionData antes de criar o pedido (igual confirm_order)
      // Adiciona itens ao carrinho se vieram no actionData
      if (actionData.items && Array.isArray(actionData.items) && actionData.items.length > 0) {
        for (const item of actionData.items) {
          if (!item?.name) continue;
          const itemName = String(item.name);
          const qty = Number(item.quantity || 1);
          const product = products.find(
            (p) =>
              p.name.toLowerCase().includes(itemName.toLowerCase()) ||
              itemName.toLowerCase().includes(p.name.toLowerCase())
          );

          if (!product) continue;

          const existing = newContext.cart.find((c) => c.productId === product.id);
          if (existing) {
            existing.quantity += qty;
          } else {
            newContext.cart.push({
              productId: product.id,
              productName: product.name,
              quantity: qty,
              price: product.price,
            });
          }
          console.log(`[AI Action] Item adicionado via request_review: ${qty}x ${product.name}`);
        }
      }
      
      // Atualiza dados do contexto se vieram no actionData
      if (isValidCustomerName(actionData.name)) {
        newContext.customerName = actionData.name.trim();
        console.log(`[AI Action] Nome definido via request_review: ${newContext.customerName}`);
      }
      if (actionData.delivery_type) {
        newContext.orderType = actionData.delivery_type === "DELIVERY" ? "DELIVERY" : "PRESENCIAL";
        console.log(`[AI Action] Tipo definido via request_review: ${newContext.orderType}`);
      }
      if (actionData.address) {
        newContext.deliveryAddress = actionData.address;
        console.log(`[AI Action] Endereço definido via request_review: ${newContext.deliveryAddress}`);
      }
      if (actionData.payment) {
        const paymentMap: Record<string, "PIX" | "CARTAO" | "DINHEIRO"> = {
          "pix": "PIX", "PIX": "PIX",
          "cartao": "CARTAO", "cartão": "CARTAO", "CARTAO": "CARTAO",
          "dinheiro": "DINHEIRO", "DINHEIRO": "DINHEIRO",
        };
        const key = String(actionData.payment).toLowerCase().trim();
        newContext.paymentMethod = paymentMap[key] || paymentMap[String(actionData.payment)] || actionData.payment;
        console.log(`[AI Action] Pagamento definido via request_review: ${newContext.paymentMethod}`);
      }
      
      if (newContext.cart.length > 0) {
        console.log("[AI Action] Cliente solicitou revisão manualmente");
        console.log(`[AI Action] Dados antes de criar pedido - Nome: ${newContext.customerName}, Tipo: ${newContext.orderType}, Endereço: ${newContext.deliveryAddress}, Pagamento: ${newContext.paymentMethod}`);
        orderNumber = (await createOrder(supabase, newContext, phone, inputType, true, "Solicitado pelo cliente")) ?? undefined;
        if (orderNumber) {
          sentToReview = true;
          console.log(`[AI Action] Pedido #${orderNumber} criado como REVISÃO (solicitado)`);
          newContext = { 
            cart: [],
            conversationHistory: newContext.conversationHistory 
          };
        }
      } else {
        confirmOrderBlocked = "missing_items";
      }
      break;
      
    case "check_status":
      // Status será buscado e retornado pela IA
      break;
  }

  return { newContext, orderNumber, confirmOrderBlocked, sentToReview };
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
  phone: string,
  inputType: "text" | "audio" = "text",
  isReview: boolean = false, // Flag para marcar como EM REVISÃO
  reviewNotes?: string // Notas adicionais sobre o que falta
): Promise<number | null> {
  const subtotal = context.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = context.orderType === "DELIVERY" ? 5 : 0;
  const total = subtotal + deliveryFee;

  // Monta as notas do pedido
  let orderNotes = "";
  if (isReview) {
    const missingFields: string[] = [];
    if (!context.customerName) missingFields.push("NOME");
    if (!context.orderType) missingFields.push("TIPO (entrega/retirada)");
    if (context.orderType === "DELIVERY" && !context.deliveryAddress) missingFields.push("ENDEREÇO");
    if (!context.paymentMethod) missingFields.push("PAGAMENTO");
    
    orderNotes = `⚠️ EM REVISÃO - Dados faltantes: ${missingFields.length > 0 ? missingFields.join(", ") : "verificar com cliente"}`;
    if (reviewNotes) {
      orderNotes += ` | ${reviewNotes}`;
    }
  }

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      channel: "WHATSAPP",
      order_type: context.orderType || "PRESENCIAL", // Default para presencial se não definido
      customer_name: context.customerName || "PENDENTE - REVISÃO",
      customer_phone: phone,
      delivery_address: context.deliveryAddress,
      payment_method: context.paymentMethod,
      subtotal,
      delivery_fee: deliveryFee,
      total,
      input_type: inputType,
      notes: orderNotes || null,
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

  console.log(`[createOrder] Pedido #${order.order_number} criado ${isReview ? "(EM REVISÃO)" : ""}`);
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

  // Mostra status de "gravando" para indicar processamento (sem mensagem de texto)
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
  
  // ESTADO CONFIRM: Confirmação final do pedido
  if (currentState === "CONFIRM") {
    if (intent === "confirm") {
      const orderNumber = await createOrder(supabase, newContext, phone);
      
      if (!orderNumber) {
        return {
          newState: "CONFIRM",
          messages: ["😥 Erro ao criar pedido! Tenta *CONFIRMAR* de novo?"],
          newContext,
          sendVoiceReply: true,
          voiceText: "Houve um erro ao criar o pedido. Pode tentar confirmar novamente?"
        };
      }
      
      const clearedContext = { cart: [] };
      
      return {
        newState: "WELCOME",
        messages: [
          "✅ *PEDIDO CONFIRMADO!*",
          `🎉 Pedido *#${orderNumber}* recebido!`,
          "Você receberá atualizações por aqui! 💛",
          "Obrigado! Digite *CARDÁPIO* para novo pedido."
        ],
        newContext: clearedContext,
        sendVoiceReply: true,
        voiceText: `Pedido número ${orderNumber} confirmado com sucesso! Você receberá atualizações por aqui. Obrigado!`
      };
    }
    
    if (intent === "deny") {
      return {
        newState: "CART",
        messages: [
          "Ok! 😊",
          "Seu carrinho está salvo. *CARRINHO* para ver ou *CANCELAR* para limpar."
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Ok, cancelei. Seu carrinho está salvo."
      };
    }
    
    // Não entendeu no estado CONFIRM - pede para repetir
    return {
      newState: "CONFIRM",
      messages: [
        "🔄 Não entendi. Diga *CONFIRMAR* para finalizar ou *CANCELAR* para voltar."
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "Não entendi. Diga confirmar para finalizar o pedido ou cancelar para voltar."
    };
  }
  
  // Se está no estado VOICE_ORDER_CONFIRM, trata confirmação/negação
  if (currentState === "VOICE_ORDER_CONFIRM") {
    if (intent === "confirm") {
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
          "❌ Ok, cancelei os itens do áudio.",
          "Pode *enviar outro áudio* ou digitar *CARDÁPIO* para escolher manualmente!"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Ok, cancelei os itens. Pode enviar outro áudio com seu pedido."
      };
    }
    
    // Não entendeu - pede para repetir
    return {
      newState: "VOICE_ORDER_CONFIRM",
      messages: [
        "🔄 Não entendi. Diga *SIM* para confirmar ou *NÃO* para cancelar."
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "Não entendi. Diga sim para confirmar ou não para cancelar."
    };
  }

  // CHECKOUT via áudio: trate a transcrição como se fosse texto digitado.
  // Sem isso, nomes/endereços/pagamento caem no fallback de interpretação de pedido e voltam para o início.
  if (
    currentState === "CHECKOUT_NAME" ||
    currentState === "CHECKOUT_TYPE" ||
    currentState === "CHECKOUT_ADDRESS" ||
    currentState === "CHECKOUT_PAYMENT"
  ) {
    const msgResult = await processMessage(supabase, phone, transcript, currentState, newContext);

    const voiceText = msgResult.messages
      .map((m) => m.replace(/\*([^*]+)\*/g, "$1").replace(/\n+/g, " ").trim())
      .join(" ")
      .trim()
      .slice(0, 900);

    return {
      ...msgResult,
      sendVoiceReply: true,
      voiceText: voiceText || "Pode repetir, por favor?",
    };
  }
  
  // Se está no estado VOICE_ORDERING, continua adicionando itens
  if (currentState === "VOICE_ORDERING") {
    // Detecta se quer finalizar
    if (intent === "finish") {
      if (newContext.cart.length === 0) {
        return {
          newState: "VOICE_ORDERING",
          messages: [
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
          `🛒 *Seu pedido:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
          "Perfeito! Vamos finalizar. Me diz seu *nome*:"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: `Anotado! Seu total é ${formatPrice(total)}. Me diz seu nome para finalizar.`
      };
    }
  }
  
  // INTENÇÃO GLOBAL: Finalizar pedido (funciona de qualquer estado se tiver carrinho)
  if (intent === "finish" && newContext.cart.length > 0) {
    const cartList = newContext.cart
      .map(item => `• ${item.quantity}x ${item.productName} - ${formatPrice(item.price * item.quantity)}`)
      .join("\n");
    const total = newContext.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    
    return {
      newState: "CHECKOUT_NAME",
      messages: [
        `🛒 *Seu pedido:*\n\n${cartList}\n\n💰 *Total: ${formatPrice(total)}*`,
        "Perfeito! Vamos finalizar. Me diz seu *nome*:"
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: `Anotado! Seu total é ${formatPrice(total)}. Me diz seu nome para finalizar.`
    };
  }
  
  // INTENÇÃO: Cardápio/Menu
  if (intent === "menu") {
    const categories = await getCategories(supabase);
    const categoryList = categories
      .map((cat, i) => `*${i + 1}* - ${cat.name}`)
      .join("\n");
    
    return {
      newState: "MENU",
      messages: [
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
          "🔄 Entendi que você quer fazer um pedido, mas não identifiquei os produtos.",
          "Pode *repetir* mais claramente?\n\nExemplo: *quero dois hambúrgueres e uma coca*"
        ],
        newContext,
        sendVoiceReply: true,
        voiceText: "Entendi que você quer fazer um pedido. Pode repetir mais claramente o que deseja?"
      };
    }
    
    // Não entendeu - pede para repetir
    return {
      newState: currentState === "VOICE_ORDERING" ? "VOICE_ORDERING" : "WELCOME",
      messages: [
        "🔄 Não entendi. Pode *repetir* de forma mais clara?\n\n💡 Dica: Fale os itens que deseja, peça *CARDÁPIO* ou consulte o *STATUS* do seu pedido."
      ],
      newContext,
      sendVoiceReply: true,
      voiceText: "Não entendi. Pode repetir de forma mais clara?"
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

      if (msgLower === "2" || msgLower.includes("delivery") || msgLower.includes("entrega")) {
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
    
    // Flag para usar modo IA inteligente
    const USE_AI_MODE = true;
    const inputType = isAudioMessage ? "audio" : "text";
    
    let textMessage = message;
    
    // Se é áudio, primeiro transcreve (sem enviar mensagem de texto)
    if (isAudioMessage) {
      // Apenas mostra status de "gravando" para indicar que está processando
      await sendRecordingStatus(phone);
      
      const audioBuffer = await downloadWhatsAppMedia(messageId);
      if (!audioBuffer) {
        await sendWhatsAppMessage(phone, "😕 Não consegui baixar o áudio. Pode tentar de novo?", true);
        return new Response(JSON.stringify({ status: "audio_error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      const transcript = await transcribeAudio(audioBuffer);
      if (!transcript || transcript.trim().length < 3) {
        await sendWhatsAppMessage(phone, "😕 Não consegui entender. Pode falar mais devagar ou digitar?", true);
        return new Response(JSON.stringify({ status: "transcription_error" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      textMessage = transcript;
      console.log(`Transcrição: ${transcript}`);
    }

    // ============ AGRUPAMENTO DE MENSAGENS ============
    // Salva a mensagem para agrupamento e verifica se deve processar agora
    await savePendingMessage(supabase, phone, textMessage, messageId, inputType);
    
    // Aguarda o tempo de agrupamento
    await delay(MESSAGE_GROUPING_DELAY_MS);
    
    // Busca mensagens agrupadas
    const groupedMessages = await getAndGroupPendingMessages(supabase, phone);
    
    if (!groupedMessages) {
      // Ainda não é hora de processar, outra mensagem pode ter chegado
      console.log(`[MessageGrouping] Aguardando mais mensagens de ${phone}`);
      return new Response(JSON.stringify({ status: "waiting_for_messages" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Combina todas as mensagens em uma só
    const combinedMessage = groupedMessages.messages.join("\n\n");
    const finalInputType = groupedMessages.inputType;
    
    console.log(`[MessageGrouping] Processando mensagem combinada: "${combinedMessage.slice(0, 100)}..."`);
    
    // Deleta mensagens pendentes
    await deletePendingMessages(supabase, phone, groupedMessages.messageIds);
    
    // Obtém sessão
    const { state, context } = await getOrCreateSession(supabase, phone);

    if (USE_AI_MODE) {
      // ============ RESUMO AUTOMÁTICO DE CONVERSA ============
      let contextWithSummary = { ...context };
      
      // Verifica se precisa atualizar o resumo
      if (shouldUpdateSummary(contextWithSummary)) {
        console.log("[Summary] Atualizando resumo da conversa...");
        contextWithSummary = await updateConversationSummary(contextWithSummary);
      }
      
      // MODO IA INTELIGENTE - Usa DeepSeek para respostas naturais
      const aiResult = await processWithAI(supabase, phone, combinedMessage, finalInputType, contextWithSummary);
      
      // Atualiza sessão com novo contexto (incluindo resumo atualizado)
      await updateSession(supabase, phone, "WELCOME", aiResult.newContext);
      
      // REGRA IMPORTANTE: Respeita o formato de entrada
      // - Se cliente mandou TEXTO → responde SOMENTE com TEXTO
      // - Se cliente mandou ÁUDIO → responde SOMENTE com ÁUDIO (voz)
      if (finalInputType === "audio") {
        // Cliente mandou áudio → responde SOMENTE com áudio
        if (aiResult.voiceReply) {
          await sendVoiceResponse(phone, aiResult.voiceReply);
        } else {
          // Fallback: se não tiver voiceReply, usa textReply como áudio
          await sendVoiceResponse(phone, aiResult.textReply);
        }
      } else {
        // ============ DIVISÃO DE RESPOSTAS LONGAS ============
        // Cliente mandou texto → responde com texto (dividido se necessário)
        await sendLongTextResponse(phone, aiResult.textReply);
      }
      
      return new Response(JSON.stringify({ status: "ok", mode: "ai", inputType: finalInputType, messagesGrouped: groupedMessages.messages.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MODO LEGADO - Máquina de estados tradicional
    let result: ProcessResult & { sendVoiceReply?: boolean; voiceText?: string };

    if (finalInputType === "audio") {
      result = await processAudioMessage(supabase, phone, messageId, context, state);
    } else {
      result = await processMessage(supabase, phone, combinedMessage, state, context);
    }

    await updateSession(supabase, phone, result.newState, result.newContext);

    // Envia mensagens de texto
    for (let i = 0; i < result.messages.length; i++) {
      if (i > 0) {
        await delay(800 + Math.random() * 700);
      }
      await sendWhatsAppMessage(phone, result.messages[i], true);
    }
    
    // RESPONDE COM ÁUDIO APENAS SE O CLIENTE ENVIOU ÁUDIO
    if (isAudioMessage && result.sendVoiceReply && result.voiceText) {
      await delay(500);
      await sendVoiceResponse(phone, result.voiceText);
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
