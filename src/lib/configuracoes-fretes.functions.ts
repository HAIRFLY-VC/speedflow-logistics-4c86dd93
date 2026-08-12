import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "adm",
  });
  if (!isAdmin) throw new Error("Apenas administradores podem acessar esta configuração");
}

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Retorna o panorama de configuração do módulo de fretes. */
export const getConfiguracoesFretes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const [{ count: transpCount }, { count: tabelasCount }, { data: tol }, { data: erp }, { data: usuarios }] =
      await Promise.all([
        context.supabase.from("transportadoras").select("id", { count: "exact", head: true }),
        context.supabase
          .from("tabelas_preco_frete")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true),
        context.supabase
          .from("configuracoes_auditoria_frete")
          .select("tolerancia_valor, tolerancia_percentual")
          .eq("id", 1)
          .maybeSingle(),
        context.supabase.from("configuracoes_erp").select("url_base, api_key").eq("id", 1).maybeSingle(),
        context.supabase
          .from("profiles")
          .select("id, full_name, phone, pode_autorizar_pagamento_frete")
          .order("full_name"),
      ]);

    return {
      transportadorasCount: transpCount ?? 0,
      tabelasAtivasCount: tabelasCount ?? 0,
      toleranciaValor: Number(tol?.tolerancia_valor ?? 0),
      toleranciaPercentual: Number(tol?.tolerancia_percentual ?? 0),
      erpConfigurado: Boolean(erp?.url_base?.trim() && erp?.api_key?.trim()),
      segredoConfigurado: Boolean(process.env["CTE_INGEST_SECRET"]),
      usuarios: (usuarios ?? []).map((u) => ({
        id: u.id,
        full_name: u.full_name ?? "",
        pode_autorizar: u.pode_autorizar_pagamento_frete ?? false,
      })),
    };
  });

/** Cria uma transportadora rapidamente. */
export const criarTransportadoraRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        razao_social: z.string().trim().min(2).max(200),
        cnpj: z.string().trim().min(11).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("transportadoras").insert({
      razao_social: data.razao_social,
      cnpj: data.cnpj.replace(/\D/g, ""),
      ativo: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const faixaSchema = z.object({
  peso_de: z.number().min(0),
  peso_ate: z.number().min(0).optional(),
  valor_por_kg: z.number().min(0),
  valor_fixo_faixa: z.number().min(0),
});

/** Cria uma tabela de preço simplificada. */
export const criarTabelaPrecoRapida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        transportadora_id: z.string().uuid(),
        nome: z.string().trim().min(2).max(200),
        tipo_calculo: z.enum(["peso", "valor"]),
        data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
        percentual_valor: z.number().min(0),
        gris_percentual: z.number().min(0),
        ad_valorem_percentual: z.number().min(0),
        pedagio_valor: z.number().min(0),
        tas_valor: z.number().min(0),
        frete_minimo: z.number().min(0),
        icms_percentual: z.number().min(0),
        uf_destino: z.string().max(2).optional().or(z.literal("")),
        faixas: z.array(faixaSchema).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    if (data.data_fim && data.data_fim < data.data_inicio) {
      throw new Error("Data fim não pode ser anterior à data início");
    }

    const payload = {
      transportadora_id: data.transportadora_id,
      nome: data.nome,
      data_inicio: data.data_inicio,
      data_fim: data.data_fim || null,
      tipo_calculo: data.tipo_calculo,
      percentual_valor: data.percentual_valor,
      gris_percentual: data.gris_percentual,
      ad_valorem_percentual: data.ad_valorem_percentual,
      pedagio_valor: data.pedagio_valor,
      tas_valor: data.tas_valor,
      frete_minimo: data.frete_minimo,
      icms_percentual: data.icms_percentual,
      uf_destino: data.uf_destino?.toUpperCase() || null,
      ativo: true,
    };

    const { data: inserted, error } = await context.supabase
      .from("tabelas_preco_frete")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const faixas = (data.faixas ?? [])
      .filter((f) => data.tipo_calculo === "peso")
      .map((f) => ({
        tabela_id: inserted.id,
        peso_de: f.peso_de,
        peso_ate: f.peso_ate ?? null,
        valor_por_kg: f.valor_por_kg,
        valor_fixo_faixa: f.valor_fixo_faixa,
      }));

    if (faixas.length) {
      const { error: faixaErr } = await context.supabase.from("tabelas_preco_frete_faixas").insert(faixas);
      if (faixaErr) throw new Error(faixaErr.message);
    }

    return { ok: true, tabela_id: inserted.id };
  });

/** Salva as tolerâncias de auditoria. */
export const salvarToleranciasFretes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        toleranciaValor: z.number().min(0).max(100000),
        toleranciaPercentual: z.number().min(0).max(100),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("configuracoes_auditoria_frete")
      .update({
        tolerancia_valor: data.toleranciaValor,
        tolerancia_percentual: data.toleranciaPercentual,
      })
      .eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Salva as credenciais de integração com o ERP de pagamento. */
export const salvarConfiguracaoErp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        urlBase: z.string().trim().max(500).optional().or(z.literal("")),
        apiKey: z.string().max(500).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { error } = await context.supabase
      .from("configuracoes_erp")
      .upsert(
        {
          id: 1,
          url_base: data.urlBase?.trim() || null,
          api_key: data.apiKey?.trim() || null,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Atualiza a permissão de autorização de pagamento de um perfil. */
export const toggleAutorizacaoPagamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        podeAutorizar: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ pode_autorizar_pagamento_frete: data.podeAutorizar })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Panorama da captura automática de CT-e (endpoint, segredo e últimos recebimentos). */
export const getCapturaCteStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);

    const agora = Date.now();
    const h24 = new Date(agora - 24 * 3600_000).toISOString();
    const d7 = new Date(agora - 7 * 24 * 3600_000).toISOString();

    const [{ data: logs }, { count: total24h }, { count: total7d }, { count: erros7d }, { data: pendentes }] =
      await Promise.all([
        context.supabase
          .from("cte_ingest_logs")
          .select("id, origem, resultado, chave_acesso, cnpj_emitente, cnpj_destinatario, mensagem, created_at")
          .order("created_at", { ascending: false })
          .limit(50),
        context.supabase
          .from("cte_ingest_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", h24),
        context.supabase
          .from("cte_ingest_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", d7),
        context.supabase
          .from("cte_ingest_logs")
          .select("id", { count: "exact", head: true })
          .eq("resultado", "ERRO")
          .gte("created_at", d7),
        context.supabase
          .from("ctes")
          .select("id, chave_acesso, cnpj_emitente, cnpj_destinatario, created_at")
          .eq("status", "PENDENTE_IDENTIFICACAO")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    const { data: ultimoAuto } = await context.supabase
      .from("cte_ingest_logs")
      .select("created_at")
      .eq("origem", "SEFAZ_AUTO")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      segredoConfigurado: Boolean(process.env["CTE_INGEST_SECRET"]),
      total24h: total24h ?? 0,
      total7d: total7d ?? 0,
      erros7d: erros7d ?? 0,
      ultimoAuto: ultimoAuto?.created_at ?? null,
      logs: (logs ?? []) as Array<{
        id: string;
        origem: string;
        resultado: string;
        chave_acesso: string | null;
        cnpj_emitente: string | null;
        cnpj_destinatario: string | null;
        mensagem: string | null;
        created_at: string;
      }>,
      pendentes: (pendentes ?? []) as Array<{
        id: string;
        chave_acesso: string;
        cnpj_emitente: string | null;
        cnpj_destinatario: string | null;
        created_at: string;
      }>,
    };
  });
