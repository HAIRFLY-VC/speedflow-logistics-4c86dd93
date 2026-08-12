// Parser de XML de CT-e (modal rodoviário, layout 3.00/4.00).
// Sem dependências externas: extração por expressões regulares tolerantes a namespaces.

export type CteComponente = { nome: string; valor: number };

export type ParsedCte = {
  chave_acesso: string;
  numero: string | null;
  serie: string | null;
  cnpj_emitente: string | null;
  cnpj_destinatario: string | null;
  cnpj_remetente: string | null;
  data_emissao: string | null;
  valor_total_frete: number;
  valor_mercadoria: number;
  peso_taxado: number | null;
  uf_destino: string | null;
  componentes: CteComponente[];
  nfs_referenciadas: string[];
};

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

  return {
    chave_acesso: chave,
    numero: tagValue(ide, "nCT"),
    serie: tagValue(ide, "serie"),
    cnpj_emitente: emit ? onlyDigits(tagValue(emit, "CNPJ") ?? "") || null : null,
    cnpj_destinatario: dest ? onlyDigits(tagValue(dest, "CNPJ") ?? "") || null : null,
    data_emissao: dh ? new Date(dh).toISOString() : null,
    valor_total_frete: toNumber(tagValue(vPrest, "vTPrest") ?? tagValue(vPrest, "vRec")),
    valor_mercadoria: toNumber(tagValue(infCarga, "vCarga")),
    peso_taxado: peso,
    uf_destino: tagValue(ide, "UFFim") ?? tagValue(ide, "UFEnv"),
    componentes,
    nfs_referenciadas: Array.from(nfs),
  };
}
