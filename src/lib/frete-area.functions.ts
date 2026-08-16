import { centralDb } from "@/lib/central-db";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertStaff(context: { supabase: any; userId: string }) {
  const { data: isStaff } = await context.supabase.rpc("is_staff", {
    _user_id: context.userId,
  });
  if (!isStaff) throw new Error("Sem permissão para alterar critérios de frete");
}

export type CriterioContexto = {
  municipio: string | null;
  ufDestino: string | null;
  tabelaId: string | null;
  tabelaNome: string | null;
  rotaAtualId: string | null;
  origemRota: string | null;
  rotas: {
    id: string;
    origem: string;
    destino: string;
    tarifa_frete_peso: number;
    frete_valor_percentual: number;
    taxa_despacho: number;
    frete_minimo: number;
    peso_minimo_kg: number;
    aprendida: boolean;
  }[];
};

/** Contexto usado pela auditoria: município do CT-e, tabela e praças disponíveis. */
export const criterioFreteCte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ cteId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<CriterioContexto> => {
    await assertStaff(context);
    const { pickTabela } = await import("./cte-audit.server");
    const { parseEnderecoDestinatario } = await import("./cte-parse.server");
    const { acharRotaPorMunicipio, municipiosAprendidos } = await import("./frete-area");

    const { data: cte, error } = await centralDb
      .from("ctes")
      .select("*")
      .eq("id", data.cteId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!cte) throw new Error("CT-e não encontrado");

    const xml = (cte as { xml_conteudo?: string | null }).xml_conteudo ?? null;
    const municipio = xml ? (parseEnderecoDestinatario(xml)?.municipio ?? null) : null;

    if (!cte.transportadora_id) {
      return {
        municipio,
        ufDestino: cte.uf_destino ?? null,
        tabelaId: null,
        tabelaNome: null,
        rotaAtualId: null,
        origemRota: null,
        rotas: [],
      };
    }

    const tabela = await pickTabela(
      centralDb,
      cte.transportadora_id,
      cte.uf_destino,
      cte.data_emissao,
    );
    const rotas = tabela?.tabelas_preco_frete_rotas ?? [];
    const achado = acharRotaPorMunicipio(rotas, municipio);

    return {
      municipio,
      ufDestino: cte.uf_destino ?? null,
      tabelaId: tabela?.id ?? null,
      tabelaNome: tabela?.nome ?? null,
      rotaAtualId: achado.index >= 0 ? ((rotas[achado.index]!.id as string) ?? null) : null,
      origemRota: achado.index >= 0 ? (achado.origem ?? null) : null,
      rotas: rotas.map((r) => ({
        id: r.id as string,
        origem: r.origem,
        destino: r.destino,
        tarifa_frete_peso: Number(r.tarifa_frete_peso ?? 0),
        frete_valor_percentual: Number(r.frete_valor_percentual ?? 0),
        taxa_despacho: Number(r.taxa_despacho ?? 0),
        frete_minimo: Number(r.frete_minimo ?? 0),
        peso_minimo_kg: Number(r.peso_minimo_kg ?? 0),
        aprendida: municipio ? municipiosAprendidos(r.observacao).includes(
          (municipio ?? "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, " ")
            .trim(),
        ) : false,
      })),
    };
  });

/**
 * Grava a praça correta para o município do CT-e (aprendizado) e reaudita.
 * O vínculo fica na observação da rota da tabela de frete, valendo para todos
 * os próximos CT-e daquele município.
 */
export const definirPracaMunicipio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        cteId: z.string().uuid(),
        rotaId: z.string().uuid(),
        municipio: z.string().min(2).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const { comMunicipioAprendido, semMunicipioAprendido } = await import("./frete-area");
    const { auditCte } = await import("./cte-audit.server");

    const { data: rota, error } = await centralDb
      .from("tabelas_preco_frete_rotas")
      .select("id, tabela_id, observacao")
      .eq("id", data.rotaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rota) throw new Error("Praça não encontrada");

    // Remove o município das outras praças da mesma tabela para não haver conflito.
    const { data: irmas } = await centralDb
      .from("tabelas_preco_frete_rotas")
      .select("id, observacao")
      .eq("tabela_id", rota.tabela_id);
    for (const r of irmas ?? []) {
      if (r.id === rota.id) continue;
      const nova = semMunicipioAprendido(r.observacao, data.municipio);
      if ((nova || null) !== (r.observacao || null)) {
        await centralDb
          .from("tabelas_preco_frete_rotas")
          .update({ observacao: nova || null })
          .eq("id", r.id);
      }
    }

    const { error: upErr } = await centralDb
      .from("tabelas_preco_frete_rotas")
      .update({ observacao: comMunicipioAprendido(rota.observacao, data.municipio) })
      .eq("id", rota.id);
    if (upErr) throw new Error(upErr.message);

    const outcome = await auditCte(centralDb, data.cteId);
    return { ok: true, outcome };
  });
