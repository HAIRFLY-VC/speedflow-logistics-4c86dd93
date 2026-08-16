// Motor de auditoria de fretes: recalcula o valor esperado do CT-e a partir da
// tabela de preço vigente da transportadora e compara com o valor cobrado.
import type { CentralDatabase } from "@/integrations/central/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { acharRotaPorMunicipio } from "@/lib/frete-area";
import { parseEnderecoDestinatario } from "@/lib/cte-parse.server";

type Db = SupabaseClient<CentralDatabase>;

export type AuditItem = {
  nome: string;
  esperado: number;
  cobrado: number | null;
  /** Explicação de como o valor esperado foi calculado. */
  criterio?: string;
};

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

/** Formata moeda para os textos de critério. */
const brl = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

/** Formata número solto (peso, percentual) para os textos de critério. */
const num = (n: number) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

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
export async function pickTabela(
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

/** Percentual da tabela aplicado em reentrega.
 *  Regra padrão da tabela: região metropolitana e zona da mata = 100% do frete
 *  original; demais regiões = 50%. O valor pode ser configurado por praça
 *  (coluna `percentual_reentrega` da rota) ou na tabela. */
function percentualReentrega(
  tabela: Tabela,
  destino?: string | null,
  rotaPerc?: number | string | null,
): number {
  const daRota = Number(rotaPerc);
  if (Number.isFinite(daRota) && daRota > 0) return daRota;
  const daTabela = Number((tabela as { percentual_reentrega?: number | string }).percentual_reentrega);
  if (Number.isFinite(daTabela) && daTabela > 0) return daTabela;
  const d = (destino ?? "").toUpperCase();
  return /METROPOLITAN|ZONA DA MATA/.test(d) ? 100 : 50;
}

function calcularEsperado(
  tabela: Tabela,
  peso: number,
  valorMercadoria: number,
  cobradoTotal = 0,
  municipioDestino?: string | null,
  isReentrega = false,
): { itens: AuditItem[]; total: number; rota?: string; rotaId?: string; origemRota?: string } {
  const itens: AuditItem[] = [];
  const rotas = tabela.tabelas_preco_frete_rotas ?? [];


  let base = 0;
  let rotaNome: string | undefined;
  let rotaId: string | undefined;
  let origemRota: string | undefined;
  // Fator de reentrega aplicado aos demais componentes (GRIS, TAS).
  let fatorReentrega = 1;

  if (rotas.length > 0) {
    // Tabela por origem/destino: quando o município de entrega é conhecido,
    // usa a praça correspondente; senão, escolhe a rota cujo valor calculado
    // mais se aproxima do frete cobrado.
    const candidatas = rotas.map((r) => {
      const pesoMin = Number(r.peso_minimo_kg ?? 0);
      const pesoCob = Math.max(peso, pesoMin);
      const tarifa = Number(r.tarifa_frete_peso ?? 0);
      const percValor = Number(r.frete_valor_percentual ?? 0);
      // Reentrega paga um percentual da tabela normal (padrão 50%; 100% na
      // região metropolitana e zona da mata).
      const perc = percentualReentrega(
        tabela,
        r.destino,
        (r as { percentual_reentrega?: number | string | null }).percentual_reentrega,
      );
      const fator = isReentrega ? perc / 100 : 1;
      const fretePeso = pesoCob * tarifa * fator;
      const freteValor = (percValor / 100) * valorMercadoria * fator;
      let sub = fretePeso + freteValor;
      const min = Number(r.frete_minimo ?? 0) * fator;
      const aplicouMinimo = min > 0 && sub < min;
      if (aplicouMinimo) sub = min;
      const despacho = Number(r.taxa_despacho ?? 0) * fator;
      return {
        id: r.id as string,
        rota: `${r.origem} → ${r.destino}`,
        destino: r.destino,
        pesoCob,
        pesoMin,
        tarifa,
        percValor,
        fretePeso,
        freteValor,
        despacho,
        aplicouMinimo,
        freteMinimo: min,
        percReentrega: perc,
        total: sub + despacho,
      };
    });
    const achado = acharRotaPorMunicipio(rotas, municipioDestino);
    const escolhida =
      achado.index >= 0
        ? candidatas[achado.index]!
        : [...candidatas].sort(
            (a, b) => Math.abs(a.total - cobradoTotal) - Math.abs(b.total - cobradoTotal),
          )[0]!;
    rotaNome = escolhida.rota;
    rotaId = escolhida.id;
    origemRota = achado.index >= 0 ? (achado.origem ?? "mapa") : "aproximacao";
    if (isReentrega) fatorReentrega = escolhida.percReentrega / 100;


    const comoEscolheu =
      origemRota === "aprendido"
        ? `praça definida pelo usuário para ${municipioDestino}`
        : origemRota === "mapa"
          ? `praça do município ${municipioDestino}`
          : origemRota === "nome"
            ? `praça com o nome do município ${municipioDestino}`
            : "praça estimada pelo valor cobrado (município não identificado)";
    const reentregaTxt = isReentrega
      ? ` · reentrega: ${num(escolhida.percReentrega)}% da tabela`
      : "";
    const pesoTxt =
      escolhida.pesoCob > peso
        ? `${num(escolhida.pesoCob)} kg (peso mínimo da praça)`
        : `${num(peso)} kg`;

    itens.push({
      nome: "FRETE PESO",
      esperado: round2(escolhida.fretePeso),
      cobrado: null,
      criterio: `${pesoTxt} × ${brl(escolhida.tarifa)}/kg · ${escolhida.destino} — ${comoEscolheu}${reentregaTxt}`,
    });
    itens.push({
      nome: "FRETE VALOR",
      esperado: round2(escolhida.freteValor),
      cobrado: null,
      criterio: `${num(escolhida.percValor)}% sobre mercadoria de ${brl(valorMercadoria)} · ${escolhida.destino}${reentregaTxt}`,
    });
    if (escolhida.aplicouMinimo) {
      itens.push({
        nome: "AJUSTE FRETE MÍNIMO",
        esperado: round2(
          escolhida.freteMinimo - (escolhida.fretePeso + escolhida.freteValor),
        ),
        cobrado: null,
        criterio: `frete mínimo da praça ${escolhida.destino}: ${brl(escolhida.freteMinimo)}${reentregaTxt}`,
      });
    }
    if (escolhida.despacho) {
      itens.push({
        nome: "DESPACHO",
        esperado: round2(escolhida.despacho),
        cobrado: null,
        criterio: `taxa de despacho fixa da praça ${escolhida.destino}${reentregaTxt}`,
      });
    }
    base = escolhida.total;

  } else {
    let criterio = "";
    if (tabela.tipo_calculo === "peso") {
      const faixas = [...(tabela.tabelas_preco_frete_faixas ?? [])].sort(
        (a, b) => Number(a.peso_de) - Number(b.peso_de),
      );
      const faixa =
        faixas.find(
          (f) =>
            peso >= Number(f.peso_de) && (f.peso_ate == null || peso <= Number(f.peso_ate)),
        ) ?? faixas[faixas.length - 1];
      if (faixa) {
        base = Number(faixa.valor_fixo_faixa) + Number(faixa.valor_por_kg) * peso;
        criterio = `faixa de peso ${num(Number(faixa.peso_de))}–${
          faixa.peso_ate == null ? "acima" : `${num(Number(faixa.peso_ate))} kg`
        }: ${brl(Number(faixa.valor_fixo_faixa))} + ${brl(Number(faixa.valor_por_kg))}/kg × ${num(peso)} kg`;
      }
    } else {
      base = (Number(tabela.percentual_valor) / 100) * valorMercadoria;
      criterio = `${num(Number(tabela.percentual_valor))}% sobre mercadoria de ${brl(valorMercadoria)}`;
    }

    const minimo = Number(tabela.frete_minimo);
    if (minimo > 0 && base < minimo) {
      base = minimo;
      criterio = `frete mínimo da tabela: ${brl(minimo)}`;
    }
    if (isReentrega) {
      const perc = percentualReentrega(tabela, tabela.uf_destino);
      fatorReentrega = perc / 100;
      base = base * fatorReentrega;
      criterio = `${criterio} · reentrega: ${num(perc)}% da tabela`;
    }
    itens.push({ nome: "FRETE", esperado: round2(base), cobrado: null, criterio });

  }


  // GRIS: percentual sobre o valor da mercadoria, respeitando o valor mínimo da tabela.
  const percTxt = `${num(fatorReentrega * 100)}% da tabela`;
  const reentregaTxt2 = isReentrega ? ` · reentrega: ${percTxt}` : "";
  const grisPerc = Number(tabela.gris_percentual) / 100;
  const grisMin = Number((tabela as { gris_minimo?: number | string }).gris_minimo ?? 0);
  let gris = grisPerc * valorMercadoria;
  const grisNoMinimo = grisPerc > 0 && grisMin > 0 && gris < grisMin;
  if (grisNoMinimo) gris = grisMin;
  gris = gris * fatorReentrega;
  const adv = (Number(tabela.ad_valorem_percentual) / 100) * valorMercadoria;
  // Pedágio não é provisionado por padrão: só é considerado quando cobrado no CT-e.
  const pedagio = 0;
  const tas = Number(tabela.tas_valor) * fatorReentrega;
  if (gris) {
    itens.push({
      nome: "GRIS",
      esperado: round2(gris),
      cobrado: null,
      criterio:
        (grisNoMinimo
          ? `valor mínimo de GRIS da tabela (${brl(grisMin)}); ${num(Number(tabela.gris_percentual))}% de ${brl(valorMercadoria)} daria ${brl(grisPerc * valorMercadoria)}`
          : `${num(Number(tabela.gris_percentual))}% sobre mercadoria de ${brl(valorMercadoria)}${grisMin > 0 ? ` (mínimo ${brl(grisMin)})` : ""}`) +
        reentregaTxt2,
    });
  }
  if (adv) {
    itens.push({
      nome: "AD VALOREM",
      esperado: round2(adv),
      cobrado: null,
      criterio: `${num(Number(tabela.ad_valorem_percentual))}% sobre mercadoria de ${brl(valorMercadoria)}`,
    });
  }
  if (tas) {
    itens.push({
      nome: "TAS",
      esperado: round2(tas),
      cobrado: null,
      criterio: `valor fixo da tabela: ${brl(Number(tabela.tas_valor))}${reentregaTxt2}`,
    });
  }

  const subtotal = base + gris + adv + pedagio + tas;
  const icms = Number(tabela.icms_percentual) / 100;
  const total = icms > 0 && icms < 1 ? subtotal / (1 - icms) : subtotal;
  if (icms > 0) {
    itens.push({
      nome: "ICMS",
      esperado: round2(total - subtotal),
      cobrado: null,
      criterio: `ICMS de ${num(Number(tabela.icms_percentual))}% embutido: ${brl(subtotal)} ÷ (1 − ${num(Number(tabela.icms_percentual))}%)`,
    });
  }

  return { itens, total: round2(total), rota: rotaNome, rotaId, origemRota };
}


/** Executa a auditoria de um CT-e, grava o resultado e atualiza o status.
 *  CT-e complementar (tpCTe = 1) é auditado em conjunto com o CT-e original:
 *  o valor cobrado considera a soma do original + todos os complementos. */
export async function auditCte(db: Db, cteId: string): Promise<AuditOutcome> {
  const { data: alvo, error } = await db
    .from("ctes")
    .select("*")
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!alvo) throw new Error("CT-e não encontrado");

  // Reentrega (tipo 4) é um serviço à parte: audita sozinha, sem o original.
  const isReentrega = alvo.tipo_cte === 4;

  // Se for complemento, audita a partir do CT-e original.
  let cte = alvo;
  if (!isReentrega && alvo.chave_cte_complementado) {
    const { data: original } = await db
      .from("ctes")
      .select("*")
      .eq("chave_acesso", alvo.chave_cte_complementado)
      .maybeSingle();
    if (original) cte = original;
  } else if (
    !isReentrega &&
    alvo.tipo_cte === 1 &&
    alvo.numero_cte_complementado &&
    alvo.cnpj_emitente
  ) {
    // Sem a chave no XML: liga pelo número do CT-e original do mesmo emitente.
    const { data: original } = await db
      .from("ctes")
      .select("*")
      .eq("cnpj_emitente", alvo.cnpj_emitente)
      .eq("numero", alvo.numero_cte_complementado)
      .maybeSingle();
    if (original) cte = original;
  }

  const { data: porChave } = isReentrega
    ? { data: null }
    : await db.from("ctes").select("*").eq("chave_cte_complementado", cte.chave_acesso);
  const { data: porNumero } = !isReentrega && cte.numero && cte.cnpj_emitente
    ? await db
        .from("ctes")
        .select("*")
        .eq("cnpj_emitente", cte.cnpj_emitente)
        .eq("numero_cte_complementado", cte.numero)
    : { data: [] as typeof porChave };
  // Reentregas nunca entram na soma do CT-e original.
  const complementos = [...(porChave ?? []), ...(porNumero ?? [])].filter(
    (c, i, arr) =>
      c.id !== cte.id && c.tipo_cte !== 4 && arr.findIndex((x) => x.id === c.id) === i,
  );
  const grupoIds = [cte.id, ...complementos.map((c) => c.id)];


  const cobrado = round2(
    Number(cte.valor_total_frete) +
      complementos.reduce((s, c) => s + Number(c.valor_total_frete ?? 0), 0),
  );


  if (!cte.transportadora_id) {
    await db.from("ctes").update({ status: "PENDENTE_IDENTIFICACAO" }).in("id", grupoIds);
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
    await db.from("ctes").update({ status: "DIVERGENTE" }).in("id", grupoIds);
    for (const id of grupoIds) {
      await registrarDivergencia(db, id, "Sem tabela de preço vigente para a transportadora");
    }
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

  const compsDe = (c: { componentes: unknown }) =>
    Array.isArray(c.componentes) ? (c.componentes as { nome?: string; valor?: number }[]) : [];

  const componentes = [
    ...compsDe(cte),
    ...complementos.flatMap((c) =>
      compsDe(c).map((x) => ({
        nome: `${x.nome ?? "COMPLEMENTO"} (compl. CT-e ${c.numero ?? "s/nº"})`,
        valor: x.valor,
      })),
    ),
  ];

  // Complementos costumam não repetir peso/valor da carga: usa o maior do grupo.
  const grupo = [cte, ...complementos];
  const pesoGrupo = Math.max(...grupo.map((c) => Number(c.peso_taxado ?? 0)), 0);
  const mercadoriaGrupo = Math.max(...grupo.map((c) => Number(c.valor_mercadoria ?? 0)), 0);

  // Município de entrega (enderDest do XML) define a praça da tabela de frete.
  const xmlCte = (cte as { xml_conteudo?: string | null }).xml_conteudo ?? null;
  const municipioDestino = xmlCte
    ? (parseEnderecoDestinatario(xmlCte)?.municipio ?? null)
    : null;

  const { itens, total, rota } = calcularEsperado(
    tabela,
    pesoGrupo,
    mercadoriaGrupo,
    cobrado,
    municipioDestino,
    isReentrega,
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
      criterio: "componente cobrado no CT-e que não existe na tabela de frete",
    });
  });



  const diferenca = round2(cobrado - total);
  const percentual = total > 0 ? round2((Math.abs(diferenca) / total) * 100) : 100;

  const dentroTolerancia =
    Math.abs(diferenca) <= tolerancia.tolerancia_valor ||
    percentual <= tolerancia.tolerancia_percentual;
  const resultado: "OK" | "DIVERGENTE" = dentroTolerancia ? "OK" : "DIVERGENTE";

  const { error: insErr } = await db.from("cte_auditorias").insert(
    grupoIds.map((id) => ({
      cte_id: id,
      tabela_preco_id: tabela.id,
      valor_esperado_total: total,
      valor_cobrado_total: cobrado,
      diferenca,
      percentual_diferenca: percentual,
      detalhamento: detalhamento as unknown as Database["public"]["Tables"]["cte_auditorias"]["Insert"]["detalhamento"],
      tolerancia_aplicada: tolerancia as unknown as Database["public"]["Tables"]["cte_auditorias"]["Insert"]["tolerancia_aplicada"],
      resultado,
    })),
  );
  if (insErr) throw new Error(insErr.message);

  await db
    .from("ctes")
    .update({ status: resultado === "OK" ? "APROVADO" : "DIVERGENTE" })
    .in("id", grupoIds);

  const refTabela = rota ? `"${tabela.nome}" (rota ${rota})` : `"${tabela.nome}"`;
  const refGrupo =
    complementos.length > 0
      ? ` (auditoria conjunta: CT-e original + ${complementos.length} complemento(s))`
      : "";

  if (resultado === "DIVERGENTE") {
    for (const id of grupoIds) {
      await registrarDivergencia(
        db,
        id,
        `Diferença de ${diferenca.toFixed(2)} (${percentual.toFixed(2)}%) em relação à tabela ${refTabela}${refGrupo}`,
      );
    }
  } else {
    // Auditoria bateu: encerra divergências abertas anteriores (ex.: "sem tabela vigente").
    await db
      .from("cte_divergencias")
      .update({ status: "RESOLVIDA", resolvido_em: new Date().toISOString() })
      .in("cte_id", grupoIds)
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
    motivo: `Tabela ${refTabela}${refGrupo}`,
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
