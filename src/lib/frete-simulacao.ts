// Simulação de custo de frete de uma rota a partir da tabela de preço da
// transportadora. Espelha (de forma simplificada) o motor de auditoria de CT-e
// em `src/lib/cte-audit.server.ts`, mas roda no cliente para estimar o valor
// das rotas listadas.
import { acharRotaPorMunicipio } from "@/lib/frete-area";

export type TabelaRotaSim = {
  id?: string;
  destino: string | null;
  origem?: string | null;
  observacao?: string | null;
  tarifa_frete_peso?: number | string | null;
  frete_valor_percentual?: number | string | null;
  taxa_despacho?: number | string | null;
  frete_minimo?: number | string | null;
  peso_minimo_kg?: number | string | null;
};

export type TabelaFaixaSim = {
  peso_de?: number | string | null;
  peso_ate?: number | string | null;
  valor_por_kg?: number | string | null;
  valor_fixo_faixa?: number | string | null;
};

export type TabelaSim = {
  id: string;
  nome: string;
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  tipo_calculo: string;
  percentual_valor?: number | string | null;
  gris_percentual?: number | string | null;
  gris_minimo?: number | string | null;
  ad_valorem_percentual?: number | string | null;
  tas_valor?: number | string | null;
  frete_minimo?: number | string | null;
  icms_percentual?: number | string | null;
  transportadora_id: string;
  tabelas_preco_frete_rotas?: TabelaRotaSim[] | null;
  tabelas_preco_frete_faixas?: TabelaFaixaSim[] | null;
};

export type EntregaSim = {
  peso: number;
  valorMercadoria: number;
  municipio: string | null;
};

const n = (v: unknown) => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export type DetalheFrete = {
  metodo: "praca" | "faixa_peso" | "percentual_valor";
  praca: string | null;
  praca_id: string | null;
  praca_origem: string | null;
  peso_real: number;
  peso_minimo: number;
  peso_cobrado: number;
  tarifa_kg: number;
  frete_peso: number;
  frete_valor_perc: number;
  frete_valor: number;
  faixa: string | null;
  valor_fixo_faixa: number;
  base_calculada: number;
  frete_minimo: number;
  minimo_aplicado: boolean;
  taxa_despacho: number;
  frete_base: number;
  gris_perc: number;
  gris_minimo: number;
  gris: number;
  gris_minimo_aplicado: boolean;
  ad_valorem_perc: number;
  ad_valorem: number;
  tas: number;
  subtotal: number;
  icms_perc: number;
  icms: number;
  total: number;
};

/** Detalha a composição do custo de uma entrega. null = praça não encontrada. */
export function detalharEntrega(tabela: TabelaSim, entrega: EntregaSim): DetalheFrete | null {
  const rotas = tabela.tabelas_preco_frete_rotas ?? [];
  const d: DetalheFrete = {
    metodo: "percentual_valor", praca: null, praca_id: null, praca_origem: null, peso_real: entrega.peso, peso_minimo: 0,
    peso_cobrado: entrega.peso, tarifa_kg: 0, frete_peso: 0, frete_valor_perc: 0, frete_valor: 0,
    faixa: null, valor_fixo_faixa: 0, base_calculada: 0, frete_minimo: 0, minimo_aplicado: false,
    taxa_despacho: 0, frete_base: 0, gris_perc: 0, gris_minimo: 0, gris: 0,
    gris_minimo_aplicado: false, ad_valorem_perc: 0, ad_valorem: 0, tas: 0, subtotal: 0,
    icms_perc: 0, icms: 0, total: 0,
  };

  if (rotas.length > 0) {
    const { index, origem } = acharRotaPorMunicipio(rotas, entrega.municipio);
    if (index < 0) return null;
    const r = rotas[index]!;
    d.praca_id = r.id ?? null;
    d.praca_origem = origem;
    d.metodo = "praca";
    d.praca = [r.origem, r.destino].filter(Boolean).join(" → ") || null;
    d.peso_minimo = n(r.peso_minimo_kg);
    d.peso_cobrado = Math.max(entrega.peso, d.peso_minimo);
    d.tarifa_kg = n(r.tarifa_frete_peso);
    d.frete_peso = d.peso_cobrado * d.tarifa_kg;
    d.frete_valor_perc = n(r.frete_valor_percentual);
    d.frete_valor = (d.frete_valor_perc / 100) * entrega.valorMercadoria;
    d.base_calculada = d.frete_peso + d.frete_valor;
    d.frete_minimo = n(r.frete_minimo);
    let sub = d.base_calculada;
    if (d.frete_minimo > 0 && sub < d.frete_minimo) {
      sub = d.frete_minimo;
      d.minimo_aplicado = true;
    }
    d.taxa_despacho = n(r.taxa_despacho);
    d.frete_base = sub + d.taxa_despacho;
  } else {
    if (tabela.tipo_calculo === "peso") {
      const faixas = [...(tabela.tabelas_preco_frete_faixas ?? [])].sort(
        (a, b) => n(a.peso_de) - n(b.peso_de),
      );
      const faixa =
        faixas.find(
          (f) =>
            entrega.peso >= n(f.peso_de) && (f.peso_ate == null || entrega.peso <= n(f.peso_ate)),
        ) ?? faixas[faixas.length - 1];
      if (!faixa) return null;
      d.metodo = "faixa_peso";
      d.faixa = `${n(faixa.peso_de)} a ${faixa.peso_ate == null ? "∞" : n(faixa.peso_ate)} kg`;
      d.valor_fixo_faixa = n(faixa.valor_fixo_faixa);
      d.tarifa_kg = n(faixa.valor_por_kg);
      d.frete_peso = d.tarifa_kg * entrega.peso;
      d.base_calculada = d.valor_fixo_faixa + d.frete_peso;
    } else {
      d.frete_valor_perc = n(tabela.percentual_valor);
      d.frete_valor = (d.frete_valor_perc / 100) * entrega.valorMercadoria;
      d.base_calculada = d.frete_valor;
    }
    d.frete_minimo = n(tabela.frete_minimo);
    d.frete_base = d.base_calculada;
    if (d.frete_minimo > 0 && d.frete_base < d.frete_minimo) {
      d.frete_base = d.frete_minimo;
      d.minimo_aplicado = true;
    }
  }

  d.gris_perc = n(tabela.gris_percentual);
  d.gris_minimo = n(tabela.gris_minimo);
  d.gris = (d.gris_perc / 100) * entrega.valorMercadoria;
  if (d.gris_perc > 0 && d.gris_minimo > 0 && d.gris < d.gris_minimo) {
    d.gris = d.gris_minimo;
    d.gris_minimo_aplicado = true;
  }
  d.ad_valorem_perc = n(tabela.ad_valorem_percentual);
  d.ad_valorem = (d.ad_valorem_perc / 100) * entrega.valorMercadoria;
  d.tas = n(tabela.tas_valor);
  d.subtotal = d.frete_base + d.gris + d.ad_valorem + d.tas;
  d.icms_perc = n(tabela.icms_percentual);
  const icms = d.icms_perc / 100;
  const total = icms > 0 && icms < 1 ? d.subtotal / (1 - icms) : d.subtotal;
  d.total = round2(total);
  d.icms = round2(d.total - d.subtotal);
  for (const k of ["frete_peso", "frete_valor", "base_calculada", "frete_base", "gris", "ad_valorem", "subtotal"] as const)
    d[k] = round2(d[k]);
  return d;
}

/** Custo estimado de uma entrega. Retorna null quando a praça não é
 *  identificada numa tabela por origem/destino. */
export function simularEntrega(tabela: TabelaSim, entrega: EntregaSim): number | null {
  return detalharEntrega(tabela, entrega)?.total ?? null;
}

export type SimulacaoRota = {
  total: number;
  tabelaNome: string;
  entregasCalculadas: number;
  entregasTotal: number;
  parcial: boolean;
};

/** Soma o custo estimado de todas as entregas da rota. */
export function simularRota(
  tabela: TabelaSim,
  entregas: EntregaSim[],
): SimulacaoRota | null {
  if (entregas.length === 0) return null;
  let total = 0;
  let calculadas = 0;
  for (const e of entregas) {
    const v = simularEntrega(tabela, e);
    if (v == null) continue;
    total += v;
    calculadas += 1;
  }
  if (calculadas === 0) return null;
  return {
    total: round2(total),
    tabelaNome: tabela.nome,
    entregasCalculadas: calculadas,
    entregasTotal: entregas.length,
    parcial: calculadas < entregas.length,
  };
}

/** Escolhe a tabela vigente hoje para a transportadora (considera o vínculo N:N). */
export function tabelaVigenteDaTransportadora(
  tabelas: TabelaSim[],
  vinculos: { tabela_id: string; transportadora_id: string }[],
  transportadoraId: string,
): TabelaSim | null {
  const hoje = new Date().toISOString().slice(0, 10);
  const idsVinculados = new Set(
    vinculos.filter((v) => v.transportadora_id === transportadoraId).map((v) => v.tabela_id),
  );
  const candidatas = tabelas.filter(
    (t) =>
      t.ativo &&
      (t.transportadora_id === transportadoraId || idsVinculados.has(t.id)) &&
      t.data_inicio <= hoje &&
      (!t.data_fim || t.data_fim >= hoje),
  );
  return (
    [...candidatas].sort((a, b) => (a.data_inicio < b.data_inicio ? 1 : -1))[0] ?? null
  );
}
