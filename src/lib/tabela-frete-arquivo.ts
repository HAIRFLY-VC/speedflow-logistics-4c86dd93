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

function nomeArquivo(path: string, nome?: string | null) {
  return nome || path.split("/").pop() || "tabela";
}

/**
 * Abre o arquivo original (ou força download quando `baixar`).
 * Baixa o conteúdo pela sessão do app e usa um link local (blob:), evitando
 * que navegadores/extensões bloqueiem o endereço externo do storage.
 */
export async function abrirArquivoTabelaFrete(
  path: string,
  nome?: string | null,
  baixar?: boolean,
) {
  const fileName = nomeArquivo(path, nome);
  void baixar; // sempre baixa (navegadores corporativos bloqueiam nova aba)
  try {
    const { data, error } = await storageClient.storage.from(TABELA_FRETE_BUCKET).download(path);
    if (error || !data) throw error ?? new Error("Arquivo não encontrado");
    const url = URL.createObjectURL(data);
    {
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    const msg = (e as Error)?.message || "";
    toast.error(
      /not found|não encontrado/i.test(msg)
        ? "Arquivo original da tabela não encontrado."
        : `Não foi possível abrir o arquivo: ${msg}`,
    );
  }
}
