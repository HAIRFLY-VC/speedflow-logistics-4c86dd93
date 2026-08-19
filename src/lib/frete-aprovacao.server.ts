// Aprovação de CT-e: distribuição dos valores nos campos do ERP, rateio por
// NF-e e publicação nas filas consumidas pelo n8n.
import { centralDb } from "@/lib/central-db";
import { buscarFretesContabilizados, numeroDaChaveNfe } from "@/lib/frete-nfe-erp.server";
import { statusErpCtes } from "@/lib/cte-status-erp.server";
import type {
  AprovacaoPreview,
  ComponentePreview,
  ErpCampoValor,
  NfePreview,
  RegistroErp,
  ValoresErp,
} from "@/lib/frete-aprovacao.types";

const zeros = (): ValoresErp => ({
  vlr_frete: 0,
  vlr_perna: 0,
  vlr_diaria: 0,
  vlr_pernoite: 0,
  vlr_reentrega: 0,
  vlr_descarrego: 0,
});

const cent = (v: number) => Math.round(v * 100) / 100;
const chaveNome = (n: string) => n.trim().toUpperCase();

/** Regras internas usadas quando não existe de-para cadastrado. */
function heuristica(nome: string): ErpCampoValor | null {
  const n = chaveNome(nome);
  if (/REENTREG/.test(n)) return "vlr_reentrega";
  if (/DESCARR|DESCARG/.test(n)) return "vlr_descarrego";
  if (/DIARIA|DIÁRIA/.test(n)) return "vlr_diaria";
  if (/PERNOITE/.test(n)) return "vlr_pernoite";
  if (/PERNA/.test(n)) return "vlr_perna";
  if (/FRETE|GRIS|TAS|DESPACHO|PEDAGIO|PEDÁGIO|AD.?VALOREM|TDE|TRT|SEC.?CAT/.test(n))
    return "vlr_frete";
  return null;
}

async function carregarMapeamentos(transportadoraId: string | null) {
  const { data, error } = await centralDb
    .from("mapeamento_componentes_erp")
    .select("transportadora_id, nome_componente_cte, campo_erp");
  if (error) throw new Error(error.message);
  const geral = new Map<string, ErpCampoValor>();
  const especifico = new Map<string, ErpCampoValor>();
  for (const m of data ?? []) {
    const nome = chaveNome(m.nome_componente_cte);
    if (m.transportadora_id == null) geral.set(nome, m.campo_erp);
    else if (transportadoraId && m.transportadora_id === transportadoraId)
      especifico.set(nome, m.campo_erp);
  }
  return { geral, especifico };
}

type CteRow = {
  id: string;
  empresa_id: string | null;
  transportadora_id: string | null;
  chave_acesso: string;
  numero: string | null;
  data_emissao: string | null;
  valor_total_frete: number;
  componentes: unknown;
  nfs_referenciadas: unknown;
  chave_cte_complementado: string | null;
  status: string;
  tipo_cte: number | null;
  motivo_complemento: string | null;
};

async function carregarCte(cteId: string): Promise<CteRow> {
  const { data, error } = await centralDb
    .from("ctes")
    .select(
      "id, empresa_id, transportadora_id, chave_acesso, numero, data_emissao, valor_total_frete, componentes, nfs_referenciadas, chave_cte_complementado, status, tipo_cte, motivo_complemento",
    )
    .eq("id", cteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("CT-e não encontrado");
  return data as unknown as CteRow;
}


/** NF-es do CT-e; complementares herdam as notas do documento original. */
async function chavesDoCte(cte: CteRow): Promise<string[]> {
  const proprias = (Array.isArray(cte.nfs_referenciadas) ? cte.nfs_referenciadas : []) as string[];
  const validas = proprias.filter((c) => /^\d{44}$/.test(String(c).replace(/\D/g, "")));
  if (validas.length > 0) return validas.map((c) => String(c).replace(/\D/g, ""));
  if (cte.chave_cte_complementado) {
    const { data } = await centralDb
      .from("ctes")
      .select("nfs_referenciadas")
      .eq("chave_acesso", cte.chave_cte_complementado)
      .maybeSingle();
    const orig = (Array.isArray(data?.nfs_referenciadas) ? data!.nfs_referenciadas : []) as string[];
    return orig
      .map((c) => String(c).replace(/\D/g, ""))
      .filter((c) => /^\d{44}$/.test(c));
  }
  return [];
}

function distribuir(
  componentes: { nome?: string; valor?: number }[],
  geral: Map<string, ErpCampoValor>,
  especifico: Map<string, ErpCampoValor>,
  /** Quando informado, todo o valor do CT-e vai para este campo (ex.: descarga). */
  forcarCampo?: { campo: ErpCampoValor; rotulo: string } | null,
) {
  const detalhe: ComponentePreview[] = [];
  const valores = zeros();
  for (const c of componentes) {
    const nome = String(c.nome ?? "").trim();
    if (!nome) continue;
    const valor = Number(c.valor ?? 0);
    if (forcarCampo) {
      valores[forcarCampo.campo] = cent(valores[forcarCampo.campo] + valor);
      detalhe.push({
        nome: forcarCampo.rotulo,
        valor,
        campo: forcarCampo.campo,
        origem: "automatico",
      });
      continue;
    }
    const k = chaveNome(nome);
    let campo: ErpCampoValor | null = null;
    let origem: ComponentePreview["origem"] = "nenhum";
    if (especifico.has(k)) {
      campo = especifico.get(k)!;
      origem = "transportadora";
    } else if (geral.has(k)) {
      campo = geral.get(k)!;
      origem = "geral";
    } else {
      campo = heuristica(nome);
      origem = campo ? "automatico" : "nenhum";
    }
    if (campo) valores[campo] = cent(valores[campo] + valor);
    detalhe.push({ nome, valor, campo, origem });
  }
  return { detalhe, valores };
}


/** Divide um valor entre as notas conforme os pesos informados. */
function ratear(total: number, pesos: number[]): number[] {
  const n = pesos.length;
  if (n === 0) return [];
  const soma = pesos.reduce((s, p) => s + p, 0);
  const base = soma > 0 ? pesos.map((p) => p / soma) : pesos.map(() => 1 / n);
  const parts = base.map((f) => cent(total * f));
  const ajuste = cent(total - parts.reduce((s, v) => s + v, 0));
  if (parts.length > 0) parts[0] = cent(parts[0]! + ajuste);
  return parts;
}

export async function montarPreview(cteId: string): Promise<AprovacaoPreview> {
  const cte = await carregarCte(cteId);

  let filial: string | null = null;
  if (cte.empresa_id) {
    const { data: emp } = await centralDb
      .from("empresas")
      .select("cod_erp")
      .eq("id", cte.empresa_id)
      .maybeSingle();
    filial = (emp as { cod_erp?: string | null } | null)?.cod_erp ?? null;
  }

  const { geral, especifico } = await carregarMapeamentos(cte.transportadora_id);
  const componentes = (Array.isArray(cte.componentes) ? cte.componentes : []) as {
    nome?: string;
    valor?: number;
  }[];
  // Complemento por descarga: todo o valor é contabilizado como descarrego.
  // Complemento por estadia: todo o valor é contabilizado como pernoite.
  const isDescarga =
    Number(cte.tipo_cte) === 1 && /DESCARG/i.test(cte.motivo_complemento ?? "");
  const isEstadia =
    Number(cte.tipo_cte) === 1 && /ESTADIA/i.test(cte.motivo_complemento ?? "");
  const forcar = isDescarga
    ? ({ campo: "vlr_descarrego", rotulo: "DESCARGA" } as const)
    : isEstadia
      ? ({ campo: "vlr_pernoite", rotulo: "ESTADIA" } as const)
      : null;
  const { detalhe, valores } = distribuir(componentes, geral, especifico, forcar);
  const naoMapeados = detalhe.filter((d) => !d.campo).map((d) => d.nome);

  // Sem componentes detalhados, o valor total do CT-e vira frete (ou descarrego).
  if (detalhe.length === 0)
    valores[forcar?.campo ?? "vlr_frete"] = cent(Number(cte.valor_total_frete));


  const chaves = await chavesDoCte(cte);
  const { data: notasDb } = chaves.length
    ? await centralDb
        .from("nfes")
        .select("chave_acesso, numero, peso_bruto, valor_total")
        .in("chave_acesso", chaves)
    : { data: [] as { chave_acesso: string; numero: string | null; peso_bruto: number | null; valor_total: number | null }[] };
  const infoNota = new Map((notasDb ?? []).map((n) => [n.chave_acesso, n]));

  const pesos = chaves.map((c) => Number(infoNota.get(c)?.peso_bruto ?? 0));
  const valoresNf = chaves.map((c) => Number(infoNota.get(c)?.valor_total ?? 0));
  const criterio = pesos.some((p) => p > 0)
    ? pesos
    : valoresNf.some((v) => v > 0)
      ? valoresNf
      : chaves.map(() => 1);

  const rateado: Record<ErpCampoValor, number[]> = {
    vlr_frete: ratear(valores.vlr_frete, criterio),
    vlr_perna: ratear(valores.vlr_perna, criterio),
    vlr_diaria: ratear(valores.vlr_diaria, criterio),
    vlr_pernoite: ratear(valores.vlr_pernoite, criterio),
    vlr_reentrega: ratear(valores.vlr_reentrega, criterio),
    vlr_descarrego: ratear(valores.vlr_descarrego, criterio),
  };

  let registrosPorChave = new Map<string, RegistroErp[]>();
  if (chaves.length > 0 && filial) {
    try {
      const erp = await buscarFretesContabilizados(cte.id, chaves);
      for (const item of erp.itens) {
        const atual = registrosPorChave.get(item.chave) ?? [];
        atual.push({
          bordero: item.bordero,
          dt_saida: item.dt_saida,
          vlr_frete: item.vlr_frete,
          vlr_perna: item.vlr_perna,
          vlr_diaria: item.vlr_diaria,
          vlr_pernoite: item.vlr_pernoite,
          vlr_reentrega: item.vlr_reentrega,
          vlr_descarrego: item.vlr_descarrego,
        });
        registrosPorChave.set(item.chave, atual);
      }
    } catch {
      registrosPorChave = new Map();
    }
  }

  const notas: NfePreview[] = chaves.map((chave, i) => ({
    chave,
    numero: infoNota.get(chave)?.numero ?? numeroDaChaveNfe(chave) ?? "",
    peso_bruto: infoNota.get(chave)?.peso_bruto ?? null,
    valor_nfe: infoNota.get(chave)?.valor_total ?? null,
    valores: {
      vlr_frete: rateado.vlr_frete[i] ?? 0,
      vlr_perna: rateado.vlr_perna[i] ?? 0,
      vlr_diaria: rateado.vlr_diaria[i] ?? 0,
      vlr_pernoite: rateado.vlr_pernoite[i] ?? 0,
      vlr_reentrega: rateado.vlr_reentrega[i] ?? 0,
      vlr_descarrego: rateado.vlr_descarrego[i] ?? 0,
    },
    registros: registrosPorChave.get(chave) ?? [],
  }));

  const { data: ordem } = await centralDb
    .from("ordens_pagamento_frete")
    .select("aprovacao_status, observacao")
    .eq("cte_id", cte.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    cte_id: cte.id,
    cod_filial: filial,
    valor_total: Number(cte.valor_total_frete),
    componentes: detalhe,
    naoMapeados,
    valores,
    notas,
    jaAprovado: ordem?.aprovacao_status === "APROVADO",
    aprovacaoStatus: (ordem?.aprovacao_status ?? "PENDENTE") as AprovacaoPreview["aprovacaoStatus"],
    observacao: ordem?.observacao ?? null,
  };
}

export async function aprovar(
  cteId: string,
  userId: string,
  selecoes: { chave: string; bordero: string | null }[],
  observacao: string | null,
) {
  const preview = await montarPreview(cteId);
  if (preview.jaAprovado) throw new Error("Este CT-e já foi aprovado");
  if (preview.naoMapeados.length > 0)
    throw new Error(
      `Componentes sem de-para configurado: ${preview.naoMapeados.join(", ")}`,
    );
  if (!preview.cod_filial)
    throw new Error("A empresa do CT-e não tem código do ERP cadastrado");
  if (preview.notas.length === 0)
    throw new Error("CT-e sem NF-e válida para contabilizar no ERP");

  const escolha = new Map(selecoes.map((s) => [s.chave.replace(/\D/g, ""), s.bordero]));
  for (const nota of preview.notas) {
    if (nota.registros.length > 1 && !escolha.has(nota.chave))
      throw new Error(`Selecione o registro do ERP para a NF-e ${nota.numero}`);
  }

  const cte = await carregarCte(cteId);
  const { data: transp } = cte.transportadora_id
    ? await centralDb
        .from("transportadoras")
        .select("razao_social, cnpj, pix, banco, agencia, conta")
        .eq("id", cte.transportadora_id)
        .maybeSingle()
    : { data: null };

  const { data: ordem, error: ordemErr } = await centralDb
    .from("ordens_pagamento_frete")
    .insert({
      cte_id: cteId,
      valor_autorizado: preview.valor_total,
      autorizado_por: userId,
      autorizado_em: new Date().toISOString(),
      status: "AGUARDANDO_INTEGRACAO_ERP",
      aprovacao_status: "APROVADO",
      decidido_por: userId,
      decidido_em: new Date().toISOString(),
      observacao: observacao ?? null,
    })
    .select("id")
    .single();
  if (ordemErr) throw new Error(ordemErr.message);

  const linhas = preview.notas.map((nota) => {
    const bordero = escolha.get(nota.chave) ?? nota.registros[0]?.bordero ?? null;
    const registro = nota.registros.find((r) => r.bordero === bordero) ?? nota.registros[0] ?? null;
    return {
      ordem_pagamento_id: ordem.id,
      cte_id: cteId,
      cod_filial: preview.cod_filial,
      nro_nf: nota.numero,
      chave_nfe: nota.chave,
      ...nota.valores,
      registro_erp: registro ? { ...registro, bordero } : null,
      payload: {
        cod_filial: preview.cod_filial,
        nro_nf: nota.numero,
        bordero,
        chave_nfe: nota.chave,
        chave_cte: cte.chave_acesso,
        numero_cte: cte.numero,
        ...nota.valores,
      },
      status: "PENDENTE" as const,
    };
  });

  const { error: filaErr } = await centralDb
    .from("fila_lancamento_erp_frete")
    .insert(linhas as never);
  if (filaErr) throw new Error(filaErr.message);

  const t = transp as {
    razao_social?: string;
    cnpj?: string;
    pix?: string | null;
    banco?: string | null;
    agencia?: string | null;
    conta?: string | null;
  } | null;

  // Regra: 1 registro por CT-e na fila financeira (reprocesso substitui o anterior).
  await centralDb.from("fila_provisionamento_financeiro").delete().eq("cte_id", cteId);

  const { error: finErr } = await centralDb.from("fila_provisionamento_financeiro").insert({
    ordem_pagamento_id: ordem.id,
    cte_id: cteId,
    status: "PENDENTE",
    payload: {
      cod_filial: preview.cod_filial,
      chave_cte: cte.chave_acesso,
      numero_cte: cte.numero,
      data_emissao: cte.data_emissao,
      valor_total: preview.valor_total,
      transportadora: t
        ? {
            razao_social: t.razao_social ?? null,
            cnpj: t.cnpj ?? null,
            pix: t.pix ?? null,
            banco: t.banco ?? null,
            agencia: t.agencia ?? null,
            conta: t.conta ?? null,
          }
        : null,
      notas: preview.notas.map((n) => ({
        nro_nf: n.numero,
        chave_nfe: n.chave,
        bordero: escolha.get(n.chave) ?? n.registros[0]?.bordero ?? null,
      })),
      valores: preview.valores,
    },
  } as never);
  if (finErr) throw new Error(finErr.message);

  await centralDb.from("ctes").update({ status: "AUTORIZADO" }).eq("id", cteId);

  return { ok: true, ordem_id: ordem.id, linhas: linhas.length };
}

export async function reprovar(cteId: string, userId: string, observacao: string) {
  const { data: ordem, error } = await centralDb
    .from("ordens_pagamento_frete")
    .insert({
      cte_id: cteId,
      valor_autorizado: 0,
      status: "PENDENTE",
      aprovacao_status: "REPROVADO",
      decidido_por: userId,
      decidido_em: new Date().toISOString(),
      observacao,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await centralDb.from("ctes").update({ status: "REJEITADO", observacao }).eq("id", cteId);
  return { ok: true, ordem_id: ordem.id };
}

export async function reenviarItemFila(fila: "valores" | "financeiro", filaId: string) {
  const tabela =
    fila === "valores" ? "fila_lancamento_erp_frete" : "fila_provisionamento_financeiro";
  const { data: atual, error } = await centralDb
    .from(tabela)
    .select("*")
    .eq("id", filaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!atual) throw new Error("Item da fila não encontrado");

  await centralDb.from(tabela).delete().eq("id", filaId);
  const linha = { ...(atual as Record<string, unknown>) };
  delete linha["id"];
  delete linha["created_at"];
  delete linha["updated_at"];
  linha["status"] = "PENDENTE";
  linha["ultimo_erro"] = null;
  linha["processado_em"] = null;
  linha["tentativas"] = Number(atual["tentativas"] ?? 0);
  const { error: insErr } = await centralDb.from(tabela).insert(linha as never);
  if (insErr) throw new Error(insErr.message);
  return { ok: true };
}
