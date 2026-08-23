// Simulação de custo de frete de uma rota a partir da tabela de preço da
// transportadora. Espelha (de forma simplificada) o motor de auditoria de CT-e
// em `src/lib/cte-audit.server.ts`, mas roda no cliente para estimar o valor
// das rotas listadas.
import { acharRotaPorMunicipio } from "@/lib/frete-area";

export type TabelaRotaSim = {
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

/** Custo estimado de uma entrega. Retorna null quando a praça não é
 *  identificada numa tabela por origem/destino. */
export function simularEntrega(tabela: TabelaSim, entrega: EntregaSim): number | null {
  const rotas = tabela.tabelas_preco_frete_rotas ?? [];
  let base = 0;

  if (rotas.length > 0) {
    const { index } = acharRotaPorMunicipio(rotas, entrega.municipio);
    if (index < 0) return null;
    const r = rotas[index]!;
    const pesoCob = Math.max(entrega.peso, n(r.peso_minimo_kg));
    let sub = pesoCob * n(r.tarifa_frete_peso) + (n(r.frete_valor_percentual) / 100) * entrega.valorMercadoria;
    const min = n(r.frete_minimo);
    if (min > 0 && sub < min) sub = min;
    base = sub + n(r.taxa_despacho);
  } else if (tabela.tipo_calculo === "peso") {
    const faixas = [...(tabela.tabelas_preco_frete_faixas ?? [])].sort(
      (a, b) => n(a.peso_de) - n(b.peso_de),
    );
    const faixa =
      faixas.find(
        (f) =>
          entrega.peso >= n(f.peso_de) && (f.peso_ate == null || entrega.peso <= n(f.peso_ate)),
      ) ?? faixas[faixas.length - 1];
    if (!faixa) return null;
    base = n(faixa.valor_fixo_faixa) + n(faixa.valor_por_kg) * entrega.peso;
  } else {
    base = (n(tabela.percentual_valor) / 100) * entrega.valorMercadoria;
  }

  if (rotas.length === 0) {
    const minimo = n(tabela.frete_minimo);
    if (minimo > 0 && base < minimo) base = minimo;
  }

  const grisPerc = n(tabela.gris_percentual) / 100;
  const grisMin = n(tabela.gris_minimo);
  let gris = grisPerc * entrega.valorMercadoria;
  if (grisPerc > 0 && grisMin > 0 && gris < grisMin) gris = grisMin;
  const adv = (n(tabela.ad_valorem_percentual) / 100) * entrega.valorMercadoria;
  const tas = n(tabela.tas_valor);

  const subtotal = base + gris + adv + tas;
  const icms = n(tabela.icms_percentual) / 100;
  const total = icms > 0 && icms < 1 ? subtotal / (1 - icms) : subtotal;
  return round2(total);
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
