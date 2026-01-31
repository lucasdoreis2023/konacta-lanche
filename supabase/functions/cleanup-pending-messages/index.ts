import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Limpa mensagens pendentes com mais de 5 minutos (órfãs)
const ORPHAN_THRESHOLD_MINUTES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Calcula o timestamp limite (mensagens mais antigas que isso são órfãs)
    const thresholdTime = new Date(Date.now() - ORPHAN_THRESHOLD_MINUTES * 60 * 1000).toISOString();

    // Deleta mensagens órfãs
    const { data: deleted, error, count } = await supabase
      .from("pending_messages")
      .delete()
      .lt("created_at", thresholdTime)
      .select("id");

    if (error) {
      console.error("[Cleanup] Erro ao limpar mensagens:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const deletedCount = deleted?.length || 0;
    console.log(`[Cleanup] ${deletedCount} mensagens órfãs removidas (threshold: ${ORPHAN_THRESHOLD_MINUTES}min)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_count: deletedCount,
        threshold_minutes: ORPHAN_THRESHOLD_MINUTES 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Cleanup] Erro inesperado:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
