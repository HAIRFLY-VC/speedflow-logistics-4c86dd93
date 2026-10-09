import { supabase as storageClient } from "@/integrations/supabase/client";
import { toast } from "@/lib/toast";

/** Bucket de storage onde ficam os arquivos originais das tabelas de frete. */
export const TABELA_FRETE_BUCKET = "tabelas-frete";

/** Gera URL assinada (5 min) para o arquivo original da tabela de frete. */
export async function tabelaFreteSignedUrl(path: string, download?: string) {
  const { data, error } = await storageClient.storage
    .from(TABELA_FRETE_BUCKET)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

/** Abre o arquivo original em nova aba (ou força download quando `baixar`). */
export async function abrirArquivoTabelaFrete(
  path: string,
  nome?: string | null,
  baixar?: boolean,
) {
  try {
    const url = await tabelaFreteSignedUrl(path, baixar ? (nome ?? "tabela") : undefined);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    toast.error((e as Error).message);
  }
}
