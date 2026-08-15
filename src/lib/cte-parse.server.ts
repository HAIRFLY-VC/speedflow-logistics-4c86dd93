// Parser de XML de CT-e (modal rodoviário, layout 3.00/4.00).
// Sem dependências externas: extração por expressões regulares tolerantes a namespaces.

export type CteComponente = { nome: string; valor: number };

export type ParsedCte = {
  chave_acesso: string;
  numero: string | null;
  serie: string | null;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  cnpj_destinatario: string | null;
  cnpj_remetente: string | null;
  nome_remetente: string | null;
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
  const vPrest = sectionOf(xml, "vPrest") ?? "";
  const infCarga = sectionOf(xml, "infCarga") ?? "";

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

  // Complemento: quando a chave do original não vem no XML, tenta pelas observações.
  if (!chaveComplementado && tipoCte === 1) {
    for (const m of obsTexto.matchAll(/\d[\d\s.]{45,}|\d{44}/g)) {
      const d = onlyDigits(m[0]);
      if (d.length === 44 && d !== chave) {
        chaveComplementado = d;
        break;
      }
    }
  }

  // Número do CT-e original: "COMPL. DO JAB015270-6" -> 15270
  let numeroComplementado: string | null = null;
  const complDo = obsTexto.match(/COMPL\.?\s*(?:DO|DA|DE)?\s*[A-Z]*0*(\d{3,9})/);
  if (complDo) numeroComplementado = String(Number(complDo[1]));
  if (!numeroComplementado && chaveComplementado) {
    numeroComplementado = String(Number(chaveComplementado.slice(25, 34)));
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
  let motivo: string | null = MOTIVOS.find((k) => obsTexto.includes(k)) ?? null;
  if (!motivo) {
    const m = obsTexto.match(/MOTIVO:?\s*([^|<.]{3,60})/);
    const t = m?.[1]?.trim();
    if (t && t !== "COMPLEMENTAR") motivo = t;
  }
  if (tipoCte !== 1) motivo = null;




  return {
    chave_acesso: chave,
    numero: tagValue(ide, "nCT"),
    serie: tagValue(ide, "serie"),
    cnpj_emitente: emit ? onlyDigits(tagValue(emit, "CNPJ") ?? "") || null : null,
    nome_emitente: emit ? (tagValue(emit, "xNome") ?? "").trim() || null : null,
    cnpj_destinatario: dest ? onlyDigits(tagValue(dest, "CNPJ") ?? "") || null : null,
    cnpj_remetente: rem ? onlyDigits(tagValue(rem, "CNPJ") ?? "") || null : null,
    nome_remetente: rem ? (tagValue(rem, "xNome") ?? "").trim() || null : null,
    data_emissao: dh ? new Date(dh).toISOString() : null,
    valor_total_frete: toNumber(tagValue(vPrest, "vTPrest") ?? tagValue(vPrest, "vRec")),
    valor_mercadoria: toNumber(tagValue(infCarga, "vCarga")),
    peso_taxado: peso,
    uf_destino: tagValue(ide, "UFFim") ?? tagValue(ide, "UFEnv"),
    componentes,
    nfs_referenciadas: Array.from(nfs),
    tipo_cte: tipoCte,
    chave_cte_complementado: chaveComplementado || null,
  };
}
