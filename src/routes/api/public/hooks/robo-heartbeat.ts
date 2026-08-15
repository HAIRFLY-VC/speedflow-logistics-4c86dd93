// Sinal de vida do robô local, enviado por um temporizador próprio (independente
// do ciclo de leitura na SEFAZ). Permite distinguir "robô parado" de "robô ocupado".
import { createFileRoute } from "@tanstack/react-router";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function authorized(request: Request): boolean {
  const expected = process.env.CTE_INGEST_SECRET;
  const provided =
    request.headers.get("x-ingest-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  return Boolean(expected && provided && safeEqual(provided, expected));
}

async function registrar(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  let estado = "ocioso";
  try {
    const body = (await request.json()) as { estado?: string };
    if (body?.estado) estado = String(body.estado).slice(0, 60);
  } catch {
    // GET ou corpo vazio: mantém o estado padrão
  }
  try {
    const { registrarContatoRobo } = await import("@/lib/robo-heartbeat.server");
    await registrarContatoRobo("robo", estado);
    return Response.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/hooks/robo-heartbeat")({
  server: {
    handlers: {
      GET: async ({ request }) => registrar(request),
      POST: async ({ request }) => registrar(request),
    },
  },
});
