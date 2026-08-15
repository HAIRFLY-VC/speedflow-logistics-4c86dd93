import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Proxy autenticado para a API do banco central (esquema `speedflow`).
 *
 * O login continua sendo o do Lovable: validamos o token do usuário aqui e só
 * então encaminhamos a consulta ao banco central com a chave de serviço, que
 * nunca sai do servidor.
 */
async function requireLovableUser(request: Request): Promise<string | null> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabase = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return String(data.claims.sub);
}

async function handle({ request, params }: { request: Request; params: Record<string, string> }) {
  const userId = await requireLovableUser(request);
  if (!userId) {
    return new Response(JSON.stringify({ message: "Não autenticado" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const splat = params["_splat"] ?? "";
  const { forwardToCentral } = await import("@/lib/central-rest.server");
  try {
    return await forwardToCentral(request, splat);
  } catch (err) {
    console.error("[central-proxy]", err);
    return new Response(
      JSON.stringify({ message: err instanceof Error ? err.message : "Erro no banco central" }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/central/$")({
  server: {
    handlers: {
      GET: handle,
      POST: handle,
      PATCH: handle,
      PUT: handle,
      DELETE: handle,
      HEAD: handle,
      OPTIONS: handle,
    },
  },
});
