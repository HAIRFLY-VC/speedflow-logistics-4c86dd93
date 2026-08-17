// Parser de XML de CT-e (modal rodoviário, layout 3.00/4.00).
// Sem dependências externas: extração por expressões regulares tolerantes a namespaces.

export type CteComponente = { nome: string; valor: number };

export type TomadorPapel =
  | "REMETENTE"
  | "EXPEDIDOR"
  | "RECEBEDOR"
  | "DESTINATARIO"
  | "OUTROS";


export type ParsedCte = {
  chave_acesso: string;
  numero: string | null;
  serie: string | null;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  cnpj_destinatario: string | null;
  nome_destinatario: string | null;
  cnpj_remetente: string | null;
  nome_remetente: string | null;
  /** Tomador do serviço (quem paga o frete). */
  tomador_cnpj: string | null;
  tomador_nome: string | null;
  tomador_papel: TomadorPapel | null;

  data_emissao: string | null;
  valor_total_frete: number;
  valor_mercadoria: number;
  peso_taxado: number | null;
  uf_destino: string | null;
  componentes: CteComponente[];
  nfs_referenciadas: string[];
  /** 0 = normal, 1 = complemento de valores, 2 = anulação, 3 = substituto */
  tipo_cte: number;
  /** Chave do CT-e original quando este é um complemento. */
  chave_cte_complementado: string | null;
  /** Número do CT-e original quando este é um complemento. */
  numero_cte_complementado: string | null;
  /** Motivo do complemento (ex.: DESCARGA, ESTADIA). */
  motivo_complemento: string | null;
  /** Observações do documento (xObs e ObsCont). */
  observacoes: CteObservacao[];
};

export type CteObservacao = { campo: string; texto: string };


const onlyDigits = (v: string) => v.replace(/\D/g, "");

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function sectionOf(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1] : null;
}

function allSections(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function toNumber(v: string | null): number {
  if (!v) return 0;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Resolve o tomador do serviço (responsável financeiro pelo frete).
 *
 * `ide/toma3/toma`: 0 = remetente, 1 = expedidor, 2 = recebedor, 3 = destinatário.
 * Quando existe `ide/toma4`, o tomador é um terceiro e seus dados vêm do próprio grupo.
 */
function resolverTomador(p: {
  ide: string;
  xml: string;
  rem: string;
  exped: string;
  receb: string;
  dest: string;
}): { cnpj: string | null; nome: string | null; papel: TomadorPapel | null } {
  const doc = (sec: string) =>
    sec ? onlyDigits(tagValue(sec, "CNPJ") ?? tagValue(sec, "CPF") ?? "") || null : null;
  const nome = (sec: string) => (sec ? (tagValue(sec, "xNome") ?? "").trim() || null : null);

  const toma4 = sectionOf(p.ide, "toma4") ?? sectionOf(p.xml, "toma4");
  if (toma4) {
    return { cnpj: doc(toma4), nome: nome(toma4), papel: "OUTROS" };
  }

  const toma3 = sectionOf(p.ide, "toma3") ?? sectionOf(p.xml, "toma3");
  const raw = toma3 ? tagValue(toma3, "toma") : (tagValue(p.ide, "toma") ?? null);
  if (raw === null) return { cnpj: null, nome: null, papel: null };

  const map: Record<string, { sec: string; papel: TomadorPapel }> = {
    "0": { sec: p.rem, papel: "REMETENTE" },
    "1": { sec: p.exped, papel: "EXPEDIDOR" },
    "2": { sec: p.receb, papel: "RECEBEDOR" },
    "3": { sec: p.dest, papel: "DESTINATARIO" },
  };
  const hit = map[raw.trim()];
  if (!hit) return { cnpj: null, nome: null, papel: null };
  return { cnpj: doc(hit.sec), nome: nome(hit.sec), papel: hit.papel };
}

export function parseCteXml(xml: string): ParsedCte {

  if (!xml || !/<(?:\w+:)?(CTe|cteProc|infCte)\b/i.test(xml)) {
    throw new Error("Arquivo não parece ser um XML de CT-e");
  }

  const idMatch = xml.match(/<(?:\w+:)?infCte[^>]*\bId="([^"]+)"/i);
  const chave = onlyDigits(idMatch?.[1] ?? tagValue(xml, "chCTe") ?? "");
  if (chave.length !== 44) {
    throw new Error("Chave de acesso do CT-e inválida (esperado 44 dígitos)");
  }

  const ide = sectionOf(xml, "ide") ?? "";
  const emit = sectionOf(xml, "emit") ?? "";
  const dest = sectionOf(xml, "dest") ?? "";
  const rem = sectionOf(xml, "rem") ?? "";
  const exped = sectionOf(xml, "exped") ?? "";
  const receb = sectionOf(xml, "receb") ?? "";
  const vPrest = sectionOf(xml, "vPrest") ?? "";
  const infCarga = sectionOf(xml, "infCarga") ?? "";

  const tomador = resolverTomador({ ide, xml, rem, exped, receb, dest });


  const componentes: CteComponente[] = allSections(vPrest, "Comp")
    .map((c) => ({
      nome: (tagValue(c, "xNome") ?? "").trim(),
      valor: toNumber(tagValue(c, "vComp")),
    }))
    .filter((c) => c.nome || c.valor);

  const nfs = new Set<string>();
  for (const inf of allSections(xml, "infNFe")) {
    const chNFe = onlyDigits(tagValue(inf, "chave") ?? "");
    if (chNFe.length === 44) nfs.add(chNFe);
  }
  for (const inf of allSections(xml, "infNF")) {
    const nNF = tagValue(inf, "nDoc") ?? tagValue(inf, "nro");
    if (nNF) nfs.add(nNF.trim());
  }

  // peso taxado: infQ com tpMed contendo "PESO"
  let peso: number | null = null;
  for (const q of allSections(infCarga, "infQ")) {
    const tp = (tagValue(q, "tpMed") ?? "").toUpperCase();
    if (tp.includes("PESO")) {
      const v = toNumber(tagValue(q, "qCarga"));
      if (v > 0) peso = v;
      if (tp.includes("TAXAD")) break;
    }
  }

  const dh = tagValue(ide, "dhEmi") ?? tagValue(ide, "dEmi");

  const tipoCte = Number(onlyDigits(tagValue(ide, "tpCTe") ?? "0") || 0);
  const compSec = sectionOf(xml, "infCteComp");
  let chaveComplementado = compSec ? onlyDigits(tagValue(compSec, "chCTe") ?? "") : "";
  if (chaveComplementado.length !== 44) chaveComplementado = "";

  // Observações do documento (xObs geral + ObsCont numerados)
  const observacoes: CteObservacao[] = [];
  const compl = sectionOf(xml, "compl") ?? xml;
  const xObs = tagValue(compl, "xObs");
  if (xObs) observacoes.push({ campo: "xObs", texto: xObs.replace(/\s+/g, " ").trim() });
  const obsRe = /<(?:\w+:)?ObsCont[^>]*xCampo="([^"]*)"[^>]*>([\s\S]*?)<\/(?:\w+:)?ObsCont>/gi;
  let om: RegExpExecArray | null;
  while ((om = obsRe.exec(compl)) !== null) {
    const texto = (tagValue(om[2], "xTexto") ?? "").replace(/\s+/g, " ").trim();
    if (texto) observacoes.push({ campo: om[1], texto });
  }

  const obsTexto = observacoes.map((o) => o.texto).join(" | ").toUpperCase();

  // Reentrega: o XML vem como tpCTe = 0 (normal), mas o serviço é a reentrega de
  // um CT-e anterior. Marcamos com o tipo interno 4 e referenciamos o original.
  const caracteristicas = [
    tagValue(compl, "xCaracAd") ?? "",
    tagValue(compl, "xCaracSer") ?? "",
  ]
    .join(" ")
    .toUpperCase();
  const isReentrega =
    tipoCte !== 1 && (caracteristicas.includes("REENTREGA") || obsTexto.includes("REENTREGA"));
  // Devolução: tpCTe = 0, identificada pelas características/observações do documento.
  const isDevolucao =
    tipoCte !== 1 &&
    !isReentrega &&
    (caracteristicas.includes("DEVOLUCAO") ||
      caracteristicas.includes("DEVOLUÇÃO") ||
      obsTexto.includes("DEVOLUCAO") ||
      obsTexto.includes("DEVOLUÇÃO"));
  const tipoFinal = isReentrega ? 4 : isDevolucao ? 5 : tipoCte;

  const referenciaOriginal = tipoCte === 1 || isReentrega;

  // Complemento/reentrega: quando a chave do original não vem no XML, tenta pelas observações.
  if (!chaveComplementado && referenciaOriginal) {
    for (const m of obsTexto.matchAll(/\d[\d\s.]{45,}|\d{44}/g)) {
      const d = onlyDigits(m[0]);
      if (d.length === 44 && d !== chave) {
        chaveComplementado = d;
        break;
      }
    }
  }

  // Número do CT-e original: a chave do <infCteComp> tem prioridade sobre as observações.
  let numeroComplementado: string | null = null;
  if (chaveComplementado) {
    numeroComplementado = String(Number(chaveComplementado.slice(25, 34)));
  } else {
    const refCte =
      obsTexto.match(/CT-?E\s+\d{1,3}\s+0*(\d{3,9})/) ??
      obsTexto.match(/CT-?E\s+0*(\d{3,9})/) ??
      obsTexto.match(/COMPL\.?\s*(?:DO|DA|DE)?\s*[A-Z]*0*(\d{3,9})/);
    if (refCte) numeroComplementado = String(Number(refCte[1]));
  }


  // Motivo do complemento
  const MOTIVOS = [
    "DESCARGA",
    "ESTADIA",
    "DEVOLUCAO",
    "DEVOLUÇÃO",
    "REENTREGA",
    "PEDAGIO",
    "PEDÁGIO",
    "ARMAZENAGEM",
    "PALETIZACAO",
    "PALETIZAÇÃO",
    "AJUDANTE",
    "TDE",
    "TDA",
    "DIFERENCA DE FRETE",
    "DIFERENÇA DE FRETE",
    "SEGURO",
    "GRIS",
  ];
  let motivo: string | null = isReentrega
    ? "REENTREGA"
    : (MOTIVOS.find((k) => obsTexto.includes(k)) ?? null);
  if (!motivo) {
    const m = obsTexto.match(/MOTIVO:?\s*([^|<.]{3,60})/);
    const t = m?.[1]?.trim();
    if (t && t !== "COMPLEMENTAR") motivo = t;
  }
  if (!referenciaOriginal) motivo = null;





  return {
    chave_acesso: chave,
    numero: tagValue(ide, "nCT"),
    serie: tagValue(ide, "serie"),
    cnpj_emitente: emit ? onlyDigits(tagValue(emit, "CNPJ") ?? "") || null : null,
    nome_emitente: emit ? (tagValue(emit, "xNome") ?? "").trim() || null : null,
    cnpj_destinatario: dest ? onlyDigits(tagValue(dest, "CNPJ") ?? "") || null : null,
    nome_destinatario: dest ? (tagValue(dest, "xNome") ?? "").trim() || null : null,
    cnpj_remetente: rem ? onlyDigits(tagValue(rem, "CNPJ") ?? "") || null : null,
    nome_remetente: rem ? (tagValue(rem, "xNome") ?? "").trim() || null : null,
    tomador_cnpj: tomador.cnpj,
    tomador_nome: tomador.nome,
    tomador_papel: tomador.papel,

    data_emissao: dh ? new Date(dh).toISOString() : null,
    valor_total_frete: toNumber(tagValue(vPrest, "vTPrest") ?? tagValue(vPrest, "vRec")),
    valor_mercadoria: toNumber(tagValue(infCarga, "vCarga")),
    peso_taxado: peso,
    uf_destino: tagValue(ide, "UFFim") ?? tagValue(ide, "UFEnv"),
    componentes,
    nfs_referenciadas: Array.from(nfs),
    tipo_cte: tipoFinal,
    chave_cte_complementado: chaveComplementado || null,
    numero_cte_complementado: referenciaOriginal ? numeroComplementado : null,
    motivo_complemento: motivo,
    observacoes,
  };

}

export type CteEnderecoDest = {
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  pais: string | null;
  /** Endereço formatado em uma linha. */
  formatado: string | null;
};

/** Extrai o endereço de entrega (enderDest) do XML do CT-e. */
export function parseEnderecoDestinatario(xml: string): CteEnderecoDest | null {
  const sec = sectionOf(xml, "enderDest");
  if (!sec) return null;
  const get = (t: string) => {
    const v = tagValue(sec, t);
    return v && v.trim() ? v.trim() : null;
  };
  const cepRaw = get("CEP");
  const cep = cepRaw ? onlyDigits(cepRaw).replace(/^(\d{5})(\d{3})$/, "$1-$2") : null;
  const e: CteEnderecoDest = {
    logradouro: get("xLgr"),
    numero: get("nro"),
    complemento: get("xCpl"),
    bairro: get("xBairro"),
    municipio: get("xMun"),
    uf: get("UF"),
    cep,
    pais: get("xPais"),
    formatado: null,
  };
  const linha1 = [e.logradouro, e.numero].filter(Boolean).join(", ");
  const partes = [
    [linha1, e.complemento].filter(Boolean).join(" - "),
    e.bairro,
    [e.municipio, e.uf].filter(Boolean).join("/"),
    e.cep ? `CEP ${e.cep}` : null,
  ].filter((p) => p && p.length);
  e.formatado = partes.length ? partes.join(", ") : null;
  return e.formatado ? e : null;
}

export type CteCargaMedida = { tipo: string; quantidade: number; unidade: string | null };

export type CteCarga = {
  valor_carga: number;
  produto_predominante: string | null;
  medidas: CteCargaMedida[];
  /** Quantidade de volumes/unidades declarada no CT-e (tpMed UNIDADE/VOLUME). */
  volumes: number | null;
  /** Peso real informado no CT-e (kg). */
  peso_real: number | null;
};

/** Totais de carga declarados no próprio CT-e (bloco infCarga). */
export function parseCteCarga(xml: string): CteCarga | null {
  const infCarga = sectionOf(xml, "infCarga");
  if (!infCarga) return null;

  const medidas: CteCargaMedida[] = [];
  for (const q of allSections(infCarga, "infQ")) {
    const tipo = (tagValue(q, "tpMed") ?? "").trim();
    const quantidade = toNumber(tagValue(q, "qCarga"));
    const unidade = tagValue(q, "cUnid");
    if (tipo) medidas.push({ tipo, quantidade, unidade });
  }

  const acha = (re: RegExp) =>
    medidas.find((m) => re.test(m.tipo.toUpperCase()) && m.quantidade > 0)?.quantidade ?? null;

  return {
    valor_carga: toNumber(tagValue(infCarga, "vCarga")),
    produto_predominante: tagValue(infCarga, "proPred"),
    medidas,
    volumes: acha(/UNIDADE|VOLUME|CAIXA|PACOTE/),
    peso_real: acha(/PESO\s*REAL/) ?? acha(/PESO/),
  };
}
