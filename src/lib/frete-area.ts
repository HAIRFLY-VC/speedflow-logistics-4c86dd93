/**
 * Mapeamento entre o município de entrega (destinatário do CT-e) e a "área"
 * (praça) usada nas tabelas de preço de frete.
 *
 * As tabelas das transportadoras trabalham por praça (ex.: "SERRA/SALGUEIRO
 * POLO"), enquanto o CT-e traz apenas o município. Este mapa permite escolher
 * a linha correta da tabela em vez de adivinhar pelo valor cobrado.
 *
 * Além do mapa fixo abaixo, o app "aprende": quando o usuário corrige a praça
 * de um CT-e, o município é gravado na observação da rota da tabela de frete
 * (prefixo `MUNICIPIOS:`) e passa a ter prioridade nas próximas auditorias.
 */

/** Remove acentos, pontuação e espaços extras. */
export function normalizeArea(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Município (normalizado) -> nome da praça na tabela de frete. */
const AREA_POR_MUNICIPIO: Record<string, string> = {
  "SERRA TALHADA": "SERRA/SALGUEIRO POLO",
  SALGUEIRO: "SERRA/SALGUEIRO POLO",
  CARUARU: "CARUARU POLO",
  PETROLINA: "PETROLINA POLO / JUAZEIRO DA BAHIA",
  "JUAZEIRO": "PETROLINA POLO / JUAZEIRO DA BAHIA",
  RECIFE: "REGIÃO METROPOLITANA",
  OLINDA: "REGIÃO METROPOLITANA",
  JABOATAO: "REGIÃO METROPOLITANA",
  "JABOATAO DOS GUARARAPES": "REGIÃO METROPOLITANA",
  PAULISTA: "REGIÃO METROPOLITANA",
  CAMARAGIBE: "REGIÃO METROPOLITANA",
  "SAO LOURENCO DA MATA": "REGIÃO METROPOLITANA",
  "ABREU E LIMA": "REGIÃO METROPOLITANA",
  IGARASSU: "REGIÃO METROPOLITANA",
  CABO: "REGIÃO METROPOLITANA",
  "CABO DE SANTO AGOSTINHO": "REGIÃO METROPOLITANA",
};

const MUNICIPIOS_RE = /MUNIC[ÍI]PIOS\s*:\s*([^\n]*)/i;

/** Municípios aprendidos (gravados pelo usuário) numa rota da tabela. */
export function municipiosAprendidos(observacao: string | null | undefined): string[] {
  const m = MUNICIPIOS_RE.exec(observacao ?? "");
  if (!m?.[1]) return [];
  return m[1]
    .split(";")
    .map((s) => normalizeArea(s))
    .filter(Boolean);
}

/** Devolve a observação da rota com o município adicionado à lista aprendida. */
export function comMunicipioAprendido(
  observacao: string | null | undefined,
  municipio: string,
): string {
  const alvo = normalizeArea(municipio);
  const atuais = municipiosAprendidos(observacao);
  const lista = atuais.includes(alvo) ? atuais : [...atuais, alvo];
  const linha = `MUNICIPIOS: ${lista.join("; ")}`;
  const base = (observacao ?? "").trim();
  if (MUNICIPIOS_RE.test(base)) return base.replace(MUNICIPIOS_RE, linha);
  return base ? `${base}\n${linha}` : linha;
}

/** Remove o município da lista aprendida de uma rota. */
export function semMunicipioAprendido(
  observacao: string | null | undefined,
  municipio: string,
): string {
  const alvo = normalizeArea(municipio);
  const restantes = municipiosAprendidos(observacao).filter((m) => m !== alvo);
  const base = (observacao ?? "").trim();
  if (!MUNICIPIOS_RE.test(base)) return base;
  const linha = restantes.length > 0 ? `MUNICIPIOS: ${restantes.join("; ")}` : "";
  return base.replace(MUNICIPIOS_RE, linha).trim();
}

/** Praça configurada para o município, se conhecida. */
export function areaDoMunicipio(municipio: string | null | undefined): string | null {
  if (!municipio) return null;
  return AREA_POR_MUNICIPIO[normalizeArea(municipio)] ?? null;
}

type RotaMatch = { destino: string | null; observacao?: string | null };

/** Como a praça da tabela foi escolhida para o CT-e. */
export type OrigemCriterio = "aprendido" | "mapa" | "nome" | "aproximacao";

/**
 * Escolhe a rota da tabela de frete correspondente ao município de entrega.
 * Retorna o índice da rota (ou -1) e como ela foi encontrada.
 */
export function acharRotaPorMunicipio(
  rotas: RotaMatch[],
  municipio: string | null | undefined,
): { index: number; origem: OrigemCriterio | null } {
  if (!municipio) return { index: -1, origem: null };
  const cidade = normalizeArea(municipio);

  // 1) Correção feita pelo usuário (aprendizado).
  const aprendida = rotas.findIndex((r) => municipiosAprendidos(r.observacao).includes(cidade));
  if (aprendida >= 0) return { index: aprendida, origem: "aprendido" };

  // 2) Mapa fixo município -> praça.
  const alvo = areaDoMunicipio(municipio);
  if (alvo) {
    const alvoNorm = normalizeArea(alvo);
    const i = rotas.findIndex((r) => r.destino && normalizeArea(r.destino) === alvoNorm);
    if (i >= 0) return { index: i, origem: "mapa" };
  }

  // 3) Nome da praça igual ao município.
  const i = rotas.findIndex((r) => {
    const d = r.destino ? normalizeArea(r.destino) : "";
    return d !== "" && (d === cidade || d.startsWith(`${cidade} `));
  });
  return { index: i, origem: i >= 0 ? "nome" : null };
}
