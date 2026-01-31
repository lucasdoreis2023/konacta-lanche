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

// Envia mensagem via Evolution API
async function sendWhatsAppMessage(phone: string, message: string): Promise<boolean> {
  let evolutionUrl = Deno.env.get("EVOLUTION_API_URL");
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  const instanceName = Deno.env.get("EVOLUTION_INSTANCE_NAME");

  if (!evolutionUrl || !evolutionKey || !instanceName) {
    console.error("Evolution API não configurada - faltam variáveis de ambiente");
    return false;
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
      return false;
    }
    return true;
  } catch (error) {
    console.error("Erro ao enviar mensagem:", error);
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

// Gera mensagem baseada no status
function getStatusMessage(
  orderNumber: number, 
  status: string, 
  customerName: string | null,
  orderType: string,
  total: number
): string {
  const greeting = customerName ? `Olá, ${customerName}! ` : "Olá! ";
  
  switch (status) {
    case "EM_PREPARO":
      return `${greeting}👨‍🍳\n\n*Seu pedido #${orderNumber} está sendo preparado!*\n\nNossa equipe já começou a preparar seu pedido com muito carinho.\n\nVocê receberá uma mensagem quando estiver pronto!\n\n💰 Total: ${formatPrice(total)}`;
    
    case "PRONTO":
      if (orderType === "DELIVERY") {
        return `${greeting}🛵\n\n*Seu pedido #${orderNumber} saiu para entrega!*\n\nPrepare-se! Seu pedido está a caminho.\n\nAgradecemos a preferência! 💛\n\n💰 Total: ${formatPrice(total)}`;
      }
      return `${greeting}✅\n\n*Seu pedido #${orderNumber} está PRONTO!*\n\nVocê já pode retirar seu pedido no balcão.\n\nAgradecemos a preferência! 💛\n\n💰 Total: ${formatPrice(total)}`;
    
    case "ENTREGUE":
      return `${greeting}🎉\n\n*Pedido #${orderNumber} entregue com sucesso!*\n\nEsperamos que aproveite!\n\nDeixe sua avaliação e volte sempre! 💛\n\nDigite *CARDÁPIO* para fazer um novo pedido.`;
    
    case "CANCELADO":
      return `${greeting}❌\n\n*Pedido #${orderNumber} foi cancelado.*\n\nSe tiver dúvidas, entre em contato conosco.\n\nDigite *CARDÁPIO* para fazer um novo pedido.`;
    
    default:
      return `${greeting}📦\n\n*Atualização do pedido #${orderNumber}*\n\nStatus: ${status}\n\n💰 Total: ${formatPrice(total)}`;
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

    const { orderId, orderNumber, status, customerPhone, customerName, orderType, total } = body;

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

    // Gera mensagem personalizada
    const message = getStatusMessage(orderNumber, status, customerName, orderType, total);

    // Envia notificação via WhatsApp
    const success = await sendWhatsAppMessage(customerPhone, message);

    if (success) {
      console.log(`Notificação enviada para ${customerPhone}: Pedido #${orderNumber} - ${status}`);
      return new Response(
        JSON.stringify({ status: "sent", orderNumber, customerPhone }),
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
