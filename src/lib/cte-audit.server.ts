// Motor de auditoria de fretes: recalcula o valor esperado do CT-e a partir da
// tabela de preço vigente da transportadora e compara com o valor cobrado.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type AuditItem = { nome: string; esperado: number; cobrado: number | null };

export type AuditOutcome = {
  cte_id: string;
  chave_acesso: string;
  resultado: "OK" | "DIVERGENTE";
  valor_esperado_total: number;
  valor_cobrado_total: number;
  diferenca: number;
  percentual_diferenca: number;
  tabela_preco_id: string | null;
  detalhamento: AuditItem[];
  motivo?: string;
};

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

async function getTolerancia(db: Db) {
  const { data } = await db
    .from("configuracoes_auditoria_frete")
    .select("tolerancia_valor, tolerancia_percentual")
    .limit(1)
    .maybeSingle();
  return {
    tolerancia_valor: Number(data?.tolerancia_valor ?? 0),
    tolerancia_percentual: Number(data?.tolerancia_percentual ?? 0),
  };
}

/** Seleciona a tabela vigente mais específica (UF do CT-e antes da genérica).
 *  Se nenhuma tabela estiver vigente na data de emissão (ex.: tabela cadastrada
 *  depois), usa a vigente hoje / a mais recente cadastrada da transportadora. */
async function pickTabela(
  db: Db,
  transportadoraId: string,
  ufDestino: string | null,
  emissao: string | null,
) {
  const dia = (emissao ? new Date(emissao) : new Date()).toISOString().slice(0, 10);
  const hoje = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("tabelas_preco_frete")
    .select("*, tabelas_preco_frete_faixas(*), tabelas_preco_frete_rotas(*)")
    .eq("transportadora_id", transportadoraId)
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  const todas = data ?? [];
  const vigentesEm = (ref: string) =>
    todas.filter((t) => t.data_inicio <= ref && (!t.data_fim || t.data_fim >= ref));

  const escolher = (lista: typeof todas) => {
    const especificas = lista.filter((t) => t.uf_destino && t.uf_destino === ufDestino);
    const genericas = lista.filter((t) => !t.uf_destino);
    return [...especificas, ...genericas].sort(
      (a, b) => (a.data_inicio < b.data_inicio ? 1 : -1),
    )[0];
  };

  return (
    escolher(vigentesEm(dia)) ??
    escolher(vigentesEm(hoje)) ??
    escolher(todas) ??
    null
  );
}


type Tabela = NonNullable<Awaited<ReturnType<typeof pickTabela>>>;

function calcularEsperado(
  tabela: Tabela,
  peso: number,
  valorMercadoria: number,
  cobradoTotal = 0,
): { itens: AuditItem[]; total: number; rota?: string } {
  const itens: AuditItem[] = [];
  const rotas = tabela.tabelas_preco_frete_rotas ?? [];

  let base = 0;
  let rotaNome: string | undefined;

  if (rotas.length > 0) {
    // Tabela por origem/destino: escolhe a rota cujo valor calculado mais se
    // aproxima do frete cobrado (o CT-e não traz o nome da praça da tabela).
    const candidatas = rotas.map((r) => {
      const pesoCob = Math.max(peso, Number(r.peso_minimo_kg ?? 0));
      const fretePeso = pesoCob * Number(r.tarifa_frete_peso ?? 0);
      const freteValor = (Number(r.frete_valor_percentual ?? 0) / 100) * valorMercadoria;
      let sub = fretePeso + freteValor;
      const min = Number(r.frete_minimo ?? 0);
      if (min > 0 && sub < min) sub = min;
      const despacho = Number(r.taxa_despacho ?? 0);
      return {
        rota: `${r.origem} → ${r.destino}`,
        fretePeso,
        freteValor,
        despacho,
        total: sub + despacho,
      };
    });
    const escolhida = candidatas.sort(
      (a, b) => Math.abs(a.total - cobradoTotal) - Math.abs(b.total - cobradoTotal),
    )[0]!;
    rotaNome = escolhida.rota;
    itens.push({ nome: "FRETE PESO", esperado: round2(escolhida.fretePeso), cobrado: null });
    itens.push({ nome: "FRETE VALOR", esperado: round2(escolhida.freteValor), cobrado: null });
    if (escolhida.despacho) {
      itens.push({ nome: "DESPACHO", esperado: round2(escolhida.despacho), cobrado: null });
    }
    base = escolhida.total;
  } else {
    if (tabela.tipo_calculo === "peso") {
      const faixas = [...(tabela.tabelas_preco_frete_faixas ?? [])].sort(
        (a, b) => Number(a.peso_de) - Number(b.peso_de),
      );
      const faixa =
        faixas.find(
          (f) =>
            peso >= Number(f.peso_de) && (f.peso_ate == null || peso <= Number(f.peso_ate)),
        ) ?? faixas[faixas.length - 1];
      if (faixa) base = Number(faixa.valor_fixo_faixa) + Number(faixa.valor_por_kg) * peso;
    } else {
      base = (Number(tabela.percentual_valor) / 100) * valorMercadoria;
    }

    const minimo = Number(tabela.frete_minimo);
    if (minimo > 0 && base < minimo) base = minimo;
    itens.push({ nome: "FRETE", esperado: round2(base), cobrado: null });
  }


  const gris = (Number(tabela.gris_percentual) / 100) * valorMercadoria;
  const adv = (Number(tabela.ad_valorem_percentual) / 100) * valorMercadoria;
  const pedagio = Number(tabela.pedagio_valor);
  const tas = Number(tabela.tas_valor);
  if (gris) itens.push({ nome: "GRIS", esperado: round2(gris), cobrado: null });
  if (adv) itens.push({ nome: "AD VALOREM", esperado: round2(adv), cobrado: null });
  if (pedagio) itens.push({ nome: "PEDAGIO", esperado: round2(pedagio), cobrado: null });
  if (tas) itens.push({ nome: "TAS", esperado: round2(tas), cobrado: null });

  const subtotal = base + gris + adv + pedagio + tas;
  const icms = Number(tabela.icms_percentual) / 100;
  const total = icms > 0 && icms < 1 ? subtotal / (1 - icms) : subtotal;
  if (icms > 0) {
    itens.push({ nome: "ICMS", esperado: round2(total - subtotal), cobrado: null });
  }

  return { itens, total: round2(total), rota: rotaNome };
}

/** Executa a auditoria de um CT-e, grava o resultado e atualiza o status. */
export async function auditCte(db: Db, cteId: string): Promise<AuditOutcome> {
  const { data: cte, error } = await db
    .from("ctes")
    .select("*")
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!cte) throw new Error("CT-e não encontrado");

  const cobrado = round2(Number(cte.valor_total_frete));

  if (!cte.transportadora_id) {
    await db.from("ctes").update({ status: "PENDENTE_IDENTIFICACAO" }).eq("id", cte.id);
    return {
      cte_id: cte.id,
      chave_acesso: cte.chave_acesso,
      resultado: "DIVERGENTE",
      valor_esperado_total: 0,
      valor_cobrado_total: cobrado,
      diferenca: cobrado,
      percentual_diferenca: 100,
      tabela_preco_id: null,
      detalhamento: [],
      motivo: "Transportadora não identificada",
    };
  }

  const tabela = await pickTabela(
    db,
    cte.transportadora_id,
    cte.uf_destino,
    cte.data_emissao,
  );

  const tolerancia = await getTolerancia(db);

  if (!tabela) {
    await db.from("ctes").update({ status: "DIVERGENTE" }).eq("id", cte.id);
    await registrarDivergencia(db, cte.id, "Sem tabela de preço vigente para a transportadora");
    return {
      cte_id: cte.id,
      chave_acesso: cte.chave_acesso,
      resultado: "DIVERGENTE",
      valor_esperado_total: 0,
      valor_cobrado_total: cobrado,
      diferenca: cobrado,
      percentual_diferenca: 100,
      tabela_preco_id: null,
      detalhamento: [],
      motivo: "Sem tabela de preço vigente",
    };
  }

  const componentes = Array.isArray(cte.componentes)
    ? (cte.componentes as { nome?: string; valor?: number }[])
    : [];

  const { itens, total, rota } = calcularEsperado(
    tabela,
    Number(cte.peso_taxado ?? 0),
    Number(cte.valor_mercadoria ?? 0),
    cobrado,
  );

  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();
  const usados = new Set<number>();
  const detalhamento: AuditItem[] = itens.map((item) => {
    const alvo = norm(item.nome);
    let idx = componentes.findIndex((c, i) => !usados.has(i) && norm(c.nome ?? "") === alvo);
    if (idx < 0) {
      idx = componentes.findIndex(
        (c, i) => !usados.has(i) && norm(c.nome ?? "").startsWith(alvo),
      );
    }
    if (idx >= 0) usados.add(idx);
    return {
      ...item,
      cobrado: idx >= 0 ? round2(Number(componentes[idx]!.valor ?? 0)) : null,
    };
  });

  // Componentes cobrados no CT-e que não existem na tabela (ex.: ADICIONAL FRETE)
  // precisam aparecer, senão a soma da coluna "Cobrado" não fecha com o total.
  componentes.forEach((c, i) => {
    if (usados.has(i)) return;
    detalhamento.push({
      nome: norm(c.nome ?? "") || "OUTROS",
      esperado: 0,
      cobrado: round2(Number(c.valor ?? 0)),
    });
  });



  const diferenca = round2(cobrado - total);
  const percentual = total > 0 ? round2((Math.abs(diferenca) / total) * 100) : 100;

  const dentroTolerancia =
    Math.abs(diferenca) <= tolerancia.tolerancia_valor ||
    percentual <= tolerancia.tolerancia_percentual;
  const resultado: "OK" | "DIVERGENTE" = dentroTolerancia ? "OK" : "DIVERGENTE";

  const { error: insErr } = await db.from("cte_auditorias").insert({
    cte_id: cte.id,
    tabela_preco_id: tabela.id,
    valor_esperado_total: total,
    valor_cobrado_total: cobrado,
    diferenca,
    percentual_diferenca: percentual,
    detalhamento: detalhamento as unknown as Database["public"]["Tables"]["cte_auditorias"]["Insert"]["detalhamento"],
    tolerancia_aplicada: tolerancia as unknown as Database["public"]["Tables"]["cte_auditorias"]["Insert"]["tolerancia_aplicada"],
    resultado,
  });
  if (insErr) throw new Error(insErr.message);

  await db
    .from("ctes")
    .update({ status: resultado === "OK" ? "APROVADO" : "DIVERGENTE" })
    .eq("id", cte.id);

  const refTabela = rota ? `"${tabela.nome}" (rota ${rota})` : `"${tabela.nome}"`;

  if (resultado === "DIVERGENTE") {
    await registrarDivergencia(
      db,
      cte.id,
      `Diferença de ${diferenca.toFixed(2)} (${percentual.toFixed(2)}%) em relação à tabela ${refTabela}`,
    );
  } else {
    // Auditoria bateu: encerra divergências abertas anteriores (ex.: "sem tabela vigente").
    await db
      .from("cte_divergencias")
      .update({ status: "RESOLVIDA", resolvido_em: new Date().toISOString() })
      .eq("cte_id", cte.id)
      .neq("status", "RESOLVIDA");
  }

  return {
    cte_id: cte.id,
    chave_acesso: cte.chave_acesso,
    resultado,
    valor_esperado_total: total,
    valor_cobrado_total: cobrado,
    diferenca,
    percentual_diferenca: percentual,
    tabela_preco_id: tabela.id,
    detalhamento,
    motivo: `Tabela ${refTabela}`,
  };

}

async function registrarDivergencia(db: Db, cteId: string, motivo: string) {
  const { data: aberta } = await db
    .from("cte_divergencias")
    .select("id")
    .eq("cte_id", cteId)
    .neq("status", "RESOLVIDA")
    .maybeSingle();
  if (aberta) return;
  await db.from("cte_divergencias").insert({ cte_id: cteId, motivo, status: "ABERTA" });
}
