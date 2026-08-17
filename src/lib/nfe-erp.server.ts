// Busca do XML da NF-e na base Oracle do ERP.
//
// A SEFAZ não devolve ao emitente o XML das próprias notas (cStat=641) e recusa
// notas fora do prazo (cStat=632). O ERP guarda o XML autorizado, então esta é a
// fonte principal: o app consulta a API Oracle pela chave de acesso.
const SQL_XML_NFE = `select x.gcf_nfe_xml_nfe as xml
  from gks.gcf_nfe n, gks.gcf_nfe_xml x
 where n.gcf_nfe_chave = :chave
   and x.gcf_nfe_xml_id = n.gcf_nfe_id`;

type ErpQueryResponse = { rows?: Record<string, unknown>[] };

function normalizarXml(valor: unknown): string | null {
  if (valor == null) return null;

  // CLOB pode chegar como string, como { value }/{ data } ou como base64.
  let texto: string | null = null;
  if (typeof valor === "string") texto = valor;
  else if (Array.isArray(valor)) texto = valor.map(String).join("");
  else if (typeof valor === "object") {
    const obj = valor as Record<string, unknown>;
    const candidato = obj["value"] ?? obj["data"] ?? obj["xml"] ?? obj["content"];
    if (typeof candidato === "string") texto = candidato;
    else if (Array.isArray(candidato)) texto = candidato.map(String).join("");
  }
  if (!texto) return null;

  texto = texto.trim();
  if (!texto) return null;

  if (!texto.includes("<")) {
    // provavelmente base64
    try {
      const decodificado = Buffer.from(texto, "base64").toString("utf-8");
      if (decodificado.includes("<")) texto = decodificado.trim();
    } catch {
      return null;
    }
  }

  const minusculo = texto.toLowerCase();
  if (!minusculo.includes("<infnfe")) return null;
  return texto;
}

/**
 * Retorna o XML da NF-e guardado no ERP ou `null` quando não encontrado.
 * Lança erro apenas quando o ERP está indisponível/mal configurado.
 */
export async function buscarXmlNfeNoErp(chave: string): Promise<string | null> {
  const baseUrl = process.env["ERP_API_BASE_URL"];
  const apiKey = process.env["ERP_API_KEY"];
  if (!baseUrl || !apiKey) {
    throw new Error("ERP_API_BASE_URL ou ERP_API_KEY não configurados");
  }
  const cleanBase = baseUrl.replace(/\/+$/, "").replace(/\/v1\/query$/, "");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${cleanBase}/v1/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ sql: SQL_XML_NFE, binds: { chave }, limit: 1 }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const texto = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
      throw new Error(`ERP API ${res.status}${texto ? `: ${texto}` : ""}`);
    }
    const json = (await res.json()) as ErpQueryResponse;
    const linha = json.rows?.[0];
    if (!linha) return null;
    const bruto =
      linha["xml"] ?? linha["XML"] ?? linha["gcf_nfe_xml_nfe"] ?? linha["GCF_NFE_XML_NFE"] ??
      Object.values(linha)[0];
    return normalizarXml(bruto);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Busca no ERP e grava a nota. Devolve `true` quando o XML foi obtido.
 */
export async function importarNfeDoErp(chave: string): Promise<{
  ok: boolean;
  mensagem: string | null;
}> {
  let xml: string | null = null;
  try {
    xml = await buscarXmlNfeNoErp(chave);
  } catch (e) {
    return { ok: false, mensagem: e instanceof Error ? e.message : String(e) };
  }
  if (!xml) return { ok: false, mensagem: "NF-e não encontrada no ERP" };

  const { ingestNfeXml } = await import("./nfe-ingest.server");
  await ingestNfeXml(xml, null, "ERP");
  return { ok: true, mensagem: null };
}

/** Tenta importar várias notas do ERP; devolve as chaves importadas. */
export async function importarNfesDoErp(chaves: string[], limite = 10): Promise<string[]> {
  const importadas: string[] = [];
  for (const chave of chaves.slice(0, limite)) {
    try {
      const r = await importarNfeDoErp(chave);
      if (r.ok) importadas.push(chave);
    } catch {
      // uma nota que falha não interrompe as demais
    }
  }
  return importadas;
}
