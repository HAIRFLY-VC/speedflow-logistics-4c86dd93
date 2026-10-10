import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const chaveSchema = z.object({ chave: z.string().regex(/^\d{44}$/) });

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão");
}

export const getNfe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: nfe, error } = await centralDb
      .from("nfes")
      .select("*")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!nfe) return { nfe: null, endereco: null, praca: null };

    let endereco: {
      formatado: string | null;
      municipio: string | null;
      uf: string | null;
      pais: string | null;
    } | null = null;
    const xml = (nfe as { xml_conteudo?: string | null }).xml_conteudo;
    if (xml) {
      try {
        const { parseNfeXml } = await import("./nfe-parse.server");
        const parsed = parseNfeXml(xml);
        endereco = parsed.endereco_destinatario
          ? {
              formatado: parsed.endereco_destinatario.formatado,
              municipio: parsed.endereco_destinatario.municipio,
              uf: parsed.endereco_destinatario.uf,
              pais: parsed.endereco_destinatario.pais,
            }
          : null;
      } catch {
        endereco = null;
      }
    }

    const { data: ctes } = await centralDb
      .from("ctes")
      .select("id, transportadora_id, uf_destino, data_emissao, valor_total_frete")
      .contains("nfs_referenciadas", [data.chave])
      .order("data_emissao", { ascending: false })
      .limit(20);

    let praca: {
      nome: string;
      tabelaNome: string;
      cteId: string;
      criterio: string | null;
    } | null = null;
    const cteIds = (ctes ?? []).map((cte) => cte.id);
    if (cteIds.length > 0) {
      const { data: auditoria } = await centralDb
        .from("cte_auditorias")
        .select("cte_id, tabela_preco_id, detalhamento, created_at")
        .in("cte_id", cteIds)
        .not("tabela_preco_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const cte = auditoria
        ? (ctes ?? []).find((item) => item.id === auditoria.cte_id)
        : (ctes ?? [])[0];
      if (cte?.transportadora_id) {
        const { acharRotaPorMunicipio } = await import("./frete-area");
        const { pickTabela } = await import("./cte-audit.server");
        const tabelaEscolhida = auditoria?.tabela_preco_id
          ? await centralDb
              .from("tabelas_preco_frete")
              .select("*, tabelas_preco_frete_faixas(*), tabelas_preco_frete_rotas(*)")
              .eq("id", auditoria.tabela_preco_id)
              .maybeSingle()
              .then(({ data: tabela }) => tabela)
          : await pickTabela(
              centralDb,
              cte.transportadora_id,
              cte.uf_destino,
              cte.data_emissao,
            );
        const rotas = tabelaEscolhida?.tabelas_preco_frete_rotas ?? [];
        const achada = acharRotaPorMunicipio(rotas, endereco?.municipio);
        let rota = achada.index >= 0 ? rotas[achada.index] : null;

        if (!rota && auditoria && Array.isArray(auditoria.detalhamento)) {
          const criterios = auditoria.detalhamento
            .map((item) =>
              item && typeof item === "object" && "criterio" in item
                ? String(item.criterio ?? "")
                : "",
            )
            .join(" ");
          rota =
            rotas.find(
              (item) => item.destino && criterios.includes(`· ${item.destino} —`),
            ) ?? null;
        }

        if (tabelaEscolhida && rota) {
          praca = {
            nome: [rota.origem, rota.destino].filter(Boolean).join(" → "),
            tabelaNome: tabelaEscolhida.nome,
            cteId: cte.id,
            criterio: achada.index >= 0 ? achada.origem : "aproximacao",
          };
        }
      }
    }

    return { nfe, endereco, praca };
  });

export const uploadNfeXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ xml: z.string().min(50).max(8_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { ingestNfeXml } = await import("./nfe-ingest.server");
    return ingestNfeXml(data.xml);
  });

export const getNfeXmlUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { lerXml } = await import("./xml-store.server");
    const xml = await lerXml("nfes", { coluna: "chave_acesso", valor: data.chave }, "nfe-xml");
    if (!xml) throw new Error("XML não disponível para esta NF-e");
    return { xml };
  });

export const solicitarNfeXml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);

    const { data: existente } = await centralDb
      .from("nfes")
      .select("chave_acesso")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (existente) return { status: "CONCLUIDA" as const, mensagem: null as string | null };

    // 1) Tenta o ERP (Oracle) — é lá que estão as notas emitidas pela empresa.
    const { importarNfeDoErp } = await import("./nfe-erp.server");
    const erp = await importarNfeDoErp(data.chave);
    if (erp.ok) {
      await centralDb
        .from("nfe_solicitacoes")
        .update({ status: "CONCLUIDA", mensagem: "XML obtido no ERP" })
        .eq("chave_acesso", data.chave);
      return { status: "CONCLUIDA" as const, mensagem: "XML obtido no ERP" as string | null };
    }
    const erpMensagem = erp.mensagem;

    const { data: sol } = await centralDb
      .from("nfe_solicitacoes")
      .select("id, status")
      .eq("chave_acesso", data.chave)
      .maybeSingle();

    if (!sol) {
      const { error } = await centralDb.from("nfe_solicitacoes").insert({
        chave_acesso: data.chave,
        solicitado_por: context.userId,
        status: "PENDENTE",
      });
      if (error) throw new Error(error.message);
      return { status: "PENDENTE" as const, mensagem: erpMensagem };
    }

    if (sol.status === "ERRO") {
      await centralDb
        .from("nfe_solicitacoes")
        .update({ status: "PENDENTE", mensagem: erpMensagem })
        .eq("id", sol.id);
      return { status: "PENDENTE" as const, mensagem: erpMensagem };
    }

    return { status: sol.status, mensagem: erpMensagem };
  });

export const getNfeSolicitacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => chaveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { data: sol, error } = await centralDb
      .from("nfe_solicitacoes")
      .select("status, mensagem, tentativas, updated_at")
      .eq("chave_acesso", data.chave)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { solicitacao: sol ?? null };
  });
