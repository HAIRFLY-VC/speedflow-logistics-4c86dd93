import { createClient } from "@supabase/supabase-js";
import type { CentralDatabase } from "@/integrations/central/types";
import { supabase as authClient } from "@/integrations/supabase/client";

/**
 * Cliente de dados do SpeedFlow.
 *
 * Toda leitura/gravação de dados de negócio vai para o banco central
 * (esquema `speedflow`), através do proxy autenticado `/api/central`.
 * O login continua no Lovable: o token da sessão é anexado a cada chamada e
 * validado no servidor antes do encaminhamento.
 */
function baseUrl(): string {
  if (typeof window !== "undefined") return `${window.location.origin}/api/central`;
  return `${process.env["APP_ORIGIN"] ?? "http://localhost:8080"}/api/central`;
}

const proxyFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  try {
    const { data } = await authClient.auth.getSession();
    const token = data.session?.access_token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
  } catch {
    // sem sessão: o proxy responde 401
  }
  return fetch(input, { ...init, headers });
};

export const centralDb = createClient<CentralDatabase>(baseUrl(), "central-proxy", {
  auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  global: { fetch: proxyFetch },
});

/**
 * Alias para facilitar a migração das telas: `import { supabase } from
 * "@/integrations/central/client"` mantém o mesmo uso de antes, mas os dados
 * vêm do banco central.
 */
export const supabase = centralDb;
