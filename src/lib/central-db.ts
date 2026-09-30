/**
 * Cliente de dados do banco central (esquema `speedflow`).
 *
 * Uso EXCLUSIVO em handlers de server functions / server routes: a chave de
 * serviço é lida de `process.env` apenas no momento da chamada, portanto nunca
 * é embutida no bundle do navegador.
 *
 * A autorização do usuário (papel/permissão) deve ser verificada ANTES de usar
 * este cliente, pois ele ignora RLS.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCentralRestUrl } from "@/lib/central-rest.server";
import type { CentralDatabase } from "@/integrations/central/types";

/** Mesma tipagem das tabelas do app (os nomes são idênticos no esquema central). */
type CentralClient = SupabaseClient<CentralDatabase>;

let cached: CentralClient | null = null;

function centralUrl(): string {
  return getCentralRestUrl();
}

function makeClient(): CentralClient {
  const key = process.env["CENTRAL_SUPABASE_SERVICE_KEY"];
  if (!key) throw new Error("CENTRAL_SUPABASE_SERVICE_KEY ausente.");
  return createClient(centralUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "speedflow" },
  }) as unknown as CentralClient;
}

export function getCentralDb(): CentralClient {
  if (!cached) cached = makeClient();
  return cached;
}

/** Acesso preguiçoso: só resolve o cliente quando um método é usado. */
export const centralDb = new Proxy({} as CentralClient, {
  get(_target, prop) {
    const client = getCentralDb() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(client) : value;
  },
});
