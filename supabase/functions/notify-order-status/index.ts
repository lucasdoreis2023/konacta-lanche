import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Inicializa cliente Supabase
const getSupabase = () => {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
};

// Envia mensagem de texto via Evolution API
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada - faltam variáveis de ambiente");
    return false;
  }

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
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
    return false;
  }
}

// Gera áudio TTS via ElevenLabs
async function generateTTSAudio(text: string): Promise<ArrayBuffer | null> {
  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  
  if (!ELEVENLABS_API_KEY) {
    console.error("ELEVENLABS_API_KEY não configurada para TTS");
    return null;
  }

  // Voice ID: Nova voz selecionada pelo usuário
  const voiceId = "RGymW84CSmfVugnA5tvA";

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
            speed: 0.85, // Velocidade mais lenta para melhor compreensão
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
    // Converte ArrayBuffer para base64
    const bytes = new Uint8Array(audioBuffer);
    let binary = "";
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Audio = btoa(binary);

    console.log(`Enviando áudio de status para ${phone}, tamanho: ${bytes.length} bytes`);

    const response = await fetch(url, {
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

    console.log("Áudio de status enviado com sucesso");
    return true;
  } catch (error) {
    console.error("Erro ao enviar áudio WhatsApp:", error);
    return false;
  }
}

// Formata preço
function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

// Valida e sanitiza o nome do cliente (evita frases como "Oi, eu gostaria de fazer um pedido")
function sanitizeCustomerName(name: string | null | undefined): string | null {
  if (!name) return null;
  
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

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
  if (invalidExact.includes(cleaned)) return null;
  
  // Padrões que indicam que é uma frase, não um nome
  const invalidPatterns = [
    /\b(oi|ola|bom dia|boa tarde|boa noite)\b/,
    /\b(gostaria|quero|queria|preciso|pedido|pedir)\b/,
    /\b(fazer|enviar|mandar|trazer)\b/,
    /\b(cardapio|menu|produtos|opcoes)\b/,
    /\b(entrega|delivery|retirada|buscar)\b/,
    /\b(pix|cartao|dinheiro|pagamento)\b/,
    /\b(rua|avenida|endereco|bairro|numero)\b/,
    /[?!]/,
  ];
  
  for (const pattern of invalidPatterns) {
    if (pattern.test(cleaned)) return null;
  }
  
  // Nomes muito longos ou com muitas palavras provavelmente são frases
  if (cleaned.length > 50) return null;
  const words = cleaned.split(/\s+/).filter(w => w.length > 0);
  if (words.length > 4) return null;
  
  // Remove caracteres especiais e retorna o nome limpo
  return name.trim().replace(/[^\p{L}\s]/gu, "").trim() || null;
}

// Gera mensagem baseada no status (para texto)
function getStatusMessage(
  orderNumber: number, 
  status: string, 
  customerName: string | null,
  orderType: string
): string {
  const safeName = sanitizeCustomerName(customerName);
  const greeting = safeName ? `Olá, ${safeName}! ` : "Olá! ";
  
  switch (status) {
    case "EM_PREPARO":
      return `${greeting}👨‍🍳\n\n*Seu pedido #${orderNumber} está sendo preparado!*\n\nNossa equipe já começou a preparar seu pedido com muito carinho.\n\nVocê receberá uma mensagem quando estiver pronto!`;
    
    case "PRONTO":
      if (orderType === "DELIVERY") {
        return `${greeting}🛵\n\n*Seu pedido #${orderNumber} saiu para entrega!*\n\nPrepare-se! Seu pedido está a caminho.\n\nAgradecemos a preferência! 💛`;
      }
      return `${greeting}✅\n\n*Seu pedido #${orderNumber} está PRONTO!*\n\nVocê já pode retirar seu pedido no balcão.\n\nAgradecemos a preferência! 💛`;
    
    case "ENTREGUE":
      return `${greeting}🎉\n\n*Pedido #${orderNumber} entregue com sucesso!*\n\nEsperamos que aproveite!\n\nDeixe sua avaliação e volte sempre! 💛\n\nDigite *CARDÁPIO* para fazer um novo pedido.`;
    
    case "CANCELADO":
      return `${greeting}❌\n\n*Pedido #${orderNumber} foi cancelado.*\n\nSe tiver dúvidas, entre em contato conosco.\n\nDigite *CARDÁPIO* para fazer um novo pedido.`;
    
    default:
      return `${greeting}📦\n\n*Atualização do pedido #${orderNumber}*\n\nStatus: ${status}`;
  }
}

// Gera texto para áudio (mais natural, sem emojis)
function getStatusVoiceScript(
  orderNumber: number, 
  status: string, 
  customerName: string | null,
  orderType: string
): string {
  const safeName = sanitizeCustomerName(customerName);
  const greeting = safeName ? `Olá, ${safeName}!` : "Olá!";
  
  switch (status) {
    case "EM_PREPARO":
      return `${greeting} Seu pedido número ${orderNumber} está sendo preparado! Nossa equipe já começou a preparar com muito carinho. Você receberá uma mensagem quando estiver pronto.`;
    
    case "PRONTO":
      if (orderType === "DELIVERY") {
        return `${greeting} Seu pedido número ${orderNumber} saiu para entrega! Prepara-se, seu pedido está a caminho. Agradecemos a preferência!`;
      }
      return `${greeting} Seu pedido número ${orderNumber} está pronto! Você já pode retirar no balcão. Agradecemos a preferência!`;
    
    case "ENTREGUE":
      return `${greeting} Pedido número ${orderNumber} entregue com sucesso! Esperamos que aproveite. Volte sempre!`;
    
    case "CANCELADO":
      return `${greeting} Pedido número ${orderNumber} foi cancelado. Se tiver dúvidas, entre em contato conosco.`;
    
    default:
      return `${greeting} Atualização do pedido número ${orderNumber}. Status: ${status}.`;
  }
}

// Handler principal - chamado quando o status do pedido muda
Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Notify order status recebido:", JSON.stringify(body));

    const { orderId, orderNumber, status, customerPhone, customerName, orderType, total, inputType } = body;

    // Valida dados obrigatórios
    if (!orderNumber || !status || !customerPhone) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderNumber, status, customerPhone" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Apenas notifica para status específicos
    const notifiableStatuses = ["EM_PREPARO", "PRONTO", "ENTREGUE", "CANCELADO"];
    if (!notifiableStatuses.includes(status)) {
      return new Response(
        JSON.stringify({ status: "skipped", reason: "Status não requer notificação" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let success = false;
    
    // Se o pedido foi feito por áudio, envia notificação por áudio
    if (inputType === "audio") {
      console.log(`Enviando notificação por ÁUDIO para ${customerPhone}`);
      
      const voiceScript = getStatusVoiceScript(orderNumber, status, customerName, orderType);
      const audioBuffer = await generateTTSAudio(voiceScript);
      
      if (audioBuffer) {
        success = await sendWhatsAppAudio(customerPhone, audioBuffer);
      }
      
      // Fallback: se falhar o áudio, envia texto
      if (!success) {
        console.log("Fallback para texto após falha no áudio");
        const message = getStatusMessage(orderNumber, status, customerName, orderType);
        success = await sendWhatsAppMessage(customerPhone, message);
      }
    } else {
      // Pedido feito por texto: envia notificação por texto
      console.log(`Enviando notificação por TEXTO para ${customerPhone}`);
      const message = getStatusMessage(orderNumber, status, customerName, orderType);
      success = await sendWhatsAppMessage(customerPhone, message);
    }

    // Se o pedido foi entregue ou cancelado, reseta a conversa para permitir novo pedido
    if (success && (status === "ENTREGUE" || status === "CANCELADO")) {
      try {
        const supabase = getSupabase();
        
        // Limpa o telefone para o formato usado na tabela
        const cleanPhone = customerPhone.replace(/\D/g, "");
        
        // Reseta a sessão de conversa completamente
        const { error } = await supabase
          .from("conversation_sessions")
          .update({
            current_state: "WELCOME",
            context_json: { 
              cart: [], 
              conversationHistory: [],
              customerName: null,
              orderType: null,
              deliveryAddress: null,
              paymentMethod: null
            },
            updated_at: new Date().toISOString(),
          })
          .eq("phone_number", cleanPhone);
        
        if (error) {
          console.error("Erro ao resetar conversa:", error);
        } else {
          console.log(`Conversa resetada para ${cleanPhone} após ${status}`);
        }
      } catch (resetError) {
        console.error("Erro ao tentar resetar conversa:", resetError);
      }
    }

    if (success) {
      console.log(`Notificação enviada para ${customerPhone}: Pedido #${orderNumber} - ${status} (${inputType || 'text'})`);
      return new Response(
        JSON.stringify({ status: "sent", orderNumber, customerPhone, notificationType: inputType || "text" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      console.error(`Falha ao enviar notificação para ${customerPhone}`);
      return new Response(
        JSON.stringify({ status: "failed", error: "Failed to send WhatsApp message" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Erro na função notify-order-status:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
