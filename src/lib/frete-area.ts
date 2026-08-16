/**
 * Mapeamento entre o município de entrega (destinatário do CT-e) e a "área"
 * (praça) usada nas tabelas de preço de frete.
 *
 * As tabelas das transportadoras trabalham por praça (ex.: "SERRA/SALGUEIRO
 * POLO"), enquanto o CT-e traz apenas o município. Este mapa permite escolher
 * a linha correta da tabela em vez de adivinhar pelo valor cobrado.
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

/** Praça configurada para o município, se conhecida. */
export function areaDoMunicipio(municipio: string | null | undefined): string | null {
  if (!municipio) return null;
  return AREA_POR_MUNICIPIO[normalizeArea(municipio)] ?? null;
}

/**
 * Escolhe a rota da tabela de frete correspondente ao município de entrega.
 * Retorna o índice da rota ou -1 quando não há correspondência.
 */
export function acharRotaPorMunicipio(
  rotas: { destino: string | null }[],
  municipio: string | null | undefined,
): number {
  if (!municipio) return -1;
  const alvo = areaDoMunicipio(municipio);
  const cidade = normalizeArea(municipio);

  if (alvo) {
    const alvoNorm = normalizeArea(alvo);
    const i = rotas.findIndex((r) => r.destino && normalizeArea(r.destino) === alvoNorm);
    if (i >= 0) return i;
  }
  // Sem mapa explícito: tenta casar o nome do município com o nome da praça.
  return rotas.findIndex((r) => {
    const d = r.destino ? normalizeArea(r.destino) : "";
    return d !== "" && (d === cidade || d.startsWith(`${cidade} `));
  });
}
