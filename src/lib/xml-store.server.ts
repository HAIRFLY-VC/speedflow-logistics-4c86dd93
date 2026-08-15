// Armazenamento do XML completo no próprio banco central.
//
// Os XMLs capturados na SEFAZ (varredura por NSU, consulta por chave ou upload
// manual) ficam gravados na coluna `xml_conteudo` das tabelas `nfes` e `ctes`,
// junto dos dados já extraídos. Assim, reler o XML nunca depende da SEFAZ nem
// do bucket de arquivos.
import { centralDb } from "@/lib/central-db";

/** Colunas acrescentadas por esta funcionalidade (podem não existir num banco antigo). */
const COLUNAS_NOVAS = [
  "xml_conteudo",
  "volumes",
  "peso_liquido",
  "especie_volumes",
  "nsu",
  "xml_obtido_em",
];

function semColunasNovas<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (!COLUNAS_NOVAS.includes(k)) out[k] = v;
  }
  return out;
}

function colunaDesconhecida(message: string | undefined): boolean {
  if (!message) return false;
  return COLUNAS_NOVAS.some((c) => message.includes(c)) &&
    /column|schema cache|does not exist/i.test(message);
}

/** Upsert tolerante: se o banco ainda não tem as colunas novas, grava sem elas. */
export async function upsertComFallback(
  tabela: "nfes" | "ctes",
  row: Record<string, unknown>,
  onConflict: string,
): Promise<{ error: { message: string } | null }> {
  const { error } = await (centralDb.from(tabela) as any).upsert(row, { onConflict });
  if (error && colunaDesconhecida(error.message)) {
    const retry = await (centralDb.from(tabela) as any).upsert(semColunasNovas(row), {
      onConflict,
    });
    return { error: retry.error ?? null };
  }
  return { error: error ?? null };
}

/** Insert tolerante às colunas novas, devolvendo o id criado. */
export async function insertComFallback(
  tabela: "nfes" | "ctes",
  row: Record<string, unknown>,
): Promise<{ id: string | null; error: { message: string } | null }> {
  const first = await (centralDb.from(tabela) as any).insert(row).select("id").single();
  if (first.error && colunaDesconhecida(first.error.message)) {
    const retry = await (centralDb.from(tabela) as any)
      .insert(semColunasNovas(row))
      .select("id")
      .single();
    return { id: retry.data?.id ?? null, error: retry.error ?? null };
  }
  return { id: first.data?.id ?? null, error: first.error ?? null };
}

/** Lê o XML guardado no banco; se ainda não houver, cai para o arquivo no bucket. */
export async function lerXml(
  tabela: "nfes" | "ctes",
  filtro: { coluna: string; valor: string },
  bucket: "nfe-xml" | "cte-xml",
): Promise<string | null> {
  let storagePath: string | null = null;
  const { data, error } = await (centralDb.from(tabela) as any)
    .select("xml_conteudo, xml_storage_path")
    .eq(filtro.coluna, filtro.valor)
    .maybeSingle();

  if (!error && data) {
    if (typeof data.xml_conteudo === "string" && data.xml_conteudo.length > 50) {
      return data.xml_conteudo;
    }
    storagePath = data.xml_storage_path ?? null;
  } else {
    const alt = await (centralDb.from(tabela) as any)
      .select("xml_storage_path")
      .eq(filtro.coluna, filtro.valor)
      .maybeSingle();
    storagePath = alt.data?.xml_storage_path ?? null;
  }

  if (!storagePath) return null;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: file } = await supabaseAdmin.storage.from(bucket).download(storagePath);
    return file ? await file.text() : null;
  } catch {
    return null;
  }
}
