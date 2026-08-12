// Parser de XML de NF-e (layout 4.00) sem dependências externas.

export type NfeItem = {
  numero: number;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

export type ParsedNfe = {
  chave_acesso: string;
  numero: string | null;
  serie: string | null;
  natureza_operacao: string | null;
  cnpj_emitente: string | null;
  nome_emitente: string | null;
  cnpj_destinatario: string | null;
  nome_destinatario: string | null;
  uf_destino: string | null;
  data_emissao: string | null;
  valor_total: number;
  valor_produtos: number;
  valor_frete: number;
  peso_bruto: number | null;
  itens: NfeItem[];
};

const onlyDigits = (v: string) => v.replace(/\D/g, "");

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function sectionOf(xml: string, tag: string): string | null {
  return tagValue(xml, tag) === null ? null : matchSection(xml, tag);
}

function matchSection(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i"));
  return m ? m[1] : null;
}

function allTags(xml: string, tag: string): { attrs: string; body: string }[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}([^>]*)>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "gi");
  const out: { attrs: string; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push({ attrs: m[1], body: m[2] });
  return out;
}

function toNumber(v: string | null): number {
  if (!v) return 0;
  const n = Number(v.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function parseNfeXml(xml: string): ParsedNfe {
  if (!xml || !/<(?:\w+:)?(NFe|nfeProc|infNFe)\b/i.test(xml)) {
    throw new Error("Arquivo não parece ser um XML de NF-e");
  }

  const idMatch = xml.match(/<(?:\w+:)?infNFe[^>]*\bId="([^"]+)"/i);
  const chave = onlyDigits(idMatch?.[1] ?? tagValue(xml, "chNFe") ?? "");
  if (chave.length !== 44) {
    throw new Error("Chave de acesso da NF-e inválida (esperado 44 dígitos)");
  }

  const ide = matchSection(xml, "ide") ?? "";
  const emit = matchSection(xml, "emit") ?? "";
  const dest = matchSection(xml, "dest") ?? "";
  const total = matchSection(xml, "ICMSTot") ?? "";
  const transp = matchSection(xml, "transp") ?? "";
  const vol = matchSection(transp, "vol") ?? "";
  const enderDest = matchSection(dest, "enderDest") ?? "";

  const itens: NfeItem[] = allTags(xml, "det").map((det, i) => {
    const nItem = det.attrs.match(/nItem="(\d+)"/i)?.[1];
    const prod = matchSection(det.body, "prod") ?? "";
    return {
      numero: nItem ? Number(nItem) : i + 1,
      codigo: tagValue(prod, "cProd"),
      descricao: tagValue(prod, "xProd") ?? "—",
      ncm: tagValue(prod, "NCM"),
      cfop: tagValue(prod, "CFOP"),
      unidade: tagValue(prod, "uCom"),
      quantidade: toNumber(tagValue(prod, "qCom")),
      valor_unitario: toNumber(tagValue(prod, "vUnCom")),
      valor_total: toNumber(tagValue(prod, "vProd")),
    };
  });

  const dh = tagValue(ide, "dhEmi") ?? tagValue(ide, "dEmi");
  const pesoBruto = toNumber(tagValue(vol, "pesoB"));

  return {
    chave_acesso: chave,
    numero: tagValue(ide, "nNF"),
    serie: tagValue(ide, "serie"),
    natureza_operacao: tagValue(ide, "natOp"),
    cnpj_emitente: emit ? onlyDigits(tagValue(emit, "CNPJ") ?? "") || null : null,
    nome_emitente: tagValue(emit, "xNome"),
    cnpj_destinatario: dest
      ? onlyDigits(tagValue(dest, "CNPJ") ?? tagValue(dest, "CPF") ?? "") || null
      : null,
    nome_destinatario: tagValue(dest, "xNome"),
    uf_destino: tagValue(enderDest, "UF"),
    data_emissao: dh ? new Date(dh).toISOString() : null,
    valor_total: toNumber(tagValue(total, "vNF")),
    valor_produtos: toNumber(tagValue(total, "vProd")),
    valor_frete: toNumber(tagValue(total, "vFrete")),
    peso_bruto: pesoBruto > 0 ? pesoBruto : null,
    itens,
  };
}

export { sectionOf };
