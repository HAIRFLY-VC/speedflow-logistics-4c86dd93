// Registra o último contato do robô local com o aplicativo, para diagnóstico.
export async function registrarContatoRobo(origem: string, detalhe?: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("robo_heartbeats").upsert(
      {
        origem,
        ultimo_contato: new Date().toISOString(),
        detalhe: detalhe ?? null,
      },
      { onConflict: "origem" },
    );
  } catch {
    // heartbeat nunca deve derrubar a chamada do robô
  }
}
