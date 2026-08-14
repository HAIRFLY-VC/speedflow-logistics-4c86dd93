import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

export const solicitarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data?: { reiniciarNsu?: boolean }) => ({
    reiniciarNsu: Boolean(data?.reiniciarNsu),
  }))
  .handler(async ({ context, data }) => {
    await assertStaff(context);

    const { data: pendente } = await context.supabase
      .from("cte_captura_comandos")
      .select("id, status, created_at")
      .in("status", ["PENDENTE", "PROCESSANDO"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendente) {
      return { id: pendente.id as string, jaSolicitado: true };
    }

    const { data: novo, error } = await context.supabase
      .from("cte_captura_comandos")
      .insert({ solicitado_por: context.userId, reiniciar_nsu: data.reiniciarNsu })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    return { id: novo.id as string, jaSolicitado: false };
  });


const LIMITE_PENDENTE_MS = 3 * 60 * 1000;
const LIMITE_PROCESSANDO_MS = 10 * 60 * 1000;

export const getUltimoComandoCaptura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data, error } = await context.supabase
      .from("cte_captura_comandos")
      .select("id, status, mensagem, novos_ctes, created_at, iniciado_em, concluido_em")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    // Expira comandos que o robô nunca assumiu ou deixou travados.
    const inicio = new Date((data.iniciado_em ?? data.created_at) as string).getTime();
    const decorrido = Date.now() - inicio;
    const expirado =
      (data.status === "PENDENTE" && decorrido > LIMITE_PENDENTE_MS) ||
      (data.status === "PROCESSANDO" && decorrido > LIMITE_PROCESSANDO_MS);

    if (expirado) {
      const mensagem =
        "Robô não respondeu — verifique se o serviço local está atualizado e ativo.";
      await context.supabase
        .from("cte_captura_comandos")
        .update({ status: "ERRO", mensagem, concluido_em: new Date().toISOString() })
        .eq("id", data.id);
      return { ...data, status: "ERRO", mensagem };
    }

    return data;
  });

export const cancelarCapturaCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { error } = await context.supabase
      .from("cte_captura_comandos")
      .update({
        status: "ERRO",
        mensagem: "Cancelado pelo usuário",
        concluido_em: new Date().toISOString(),
      })
      .in("status", ["PENDENTE", "PROCESSANDO"]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * CT-e descartados por remetente não cadastrado: sem empresa cadastrada
 * nenhum documento é importado, então isso precisa ficar visível na tela.
 */
export const getRemetentesIgnorados = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);

    const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: logs, error } = await context.supabase
      .from("cte_ingest_logs")
      .select("cnpj_remetente, nome_remetente, mensagem, created_at")
      .eq("resultado", "IGNORADO")
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);

    const { data: empresas } = await context.supabase.from("empresas").select("cnpj");
    const cadastrados = new Set((empresas ?? []).map((e: { cnpj: string }) => e.cnpj));

    const mapa = new Map<
      string,
      { cnpj: string; nome: string | null; total: number; ultimo: string }
    >();
    for (const l of logs ?? []) {
      const cnpj =
        (l.cnpj_remetente as string | null) ??
        (l.mensagem as string | null)?.match(/remetente\s+(\d{11,14})/)?.[1] ??
        null;
      if (!cnpj || cadastrados.has(cnpj)) continue;
      const atual = mapa.get(cnpj);
      if (atual) {
        atual.total += 1;
        if (!atual.nome && l.nome_remetente) atual.nome = l.nome_remetente as string;
      } else {
        mapa.set(cnpj, {
          cnpj,
          nome: (l.nome_remetente as string | null) ?? null,
          total: 1,
          ultimo: l.created_at as string,
        });
      }
    }

    return {
      totalEmpresas: (empresas ?? []).length,
      remetentes: Array.from(mapa.values()).sort((a, b) => b.total - a.total),
    };
  });

/** Cadastra a empresa remetente (detentora do certificado A1) a partir dos descartes. */
export const cadastrarEmpresaRemetente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { cnpj: string; razaoSocial?: string }) => {
    const cnpj = (data?.cnpj ?? "").replace(/\D/g, "");
    if (cnpj.length !== 14) throw new Error("CNPJ inválido");
    return { cnpj, razaoSocial: (data.razaoSocial ?? "").trim() };
  })
  .handler(async ({ context, data }) => {
    await assertStaff(context);

    const { data: existente } = await context.supabase
      .from("empresas")
      .select("id")
      .eq("cnpj", data.cnpj)
      .maybeSingle();
    if (existente) return { id: existente.id as string, jaExistia: true };

    const razao = data.razaoSocial || `Empresa ${data.cnpj}`;
    const { data: nova, error } = await context.supabase
      .from("empresas")
      .insert({ cnpj: data.cnpj, razao_social: razao, ativo: true })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: nova.id as string, jaExistia: false };
  });

