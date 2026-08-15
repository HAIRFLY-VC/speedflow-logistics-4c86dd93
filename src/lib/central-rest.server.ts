/**
 * Acesso à API REST (PostgREST) do banco central.
 *
 * O app continua autenticando no Lovable, mas TODO o armazenamento de dados
 * de negócio vive no projeto central, no esquema `speedflow`. Este módulo é
 * server-only: a chave de serviço nunca chega ao navegador.
 */

/** Deriva `https://<ref>.supabase.co` a partir da string de conexão do banco. */
export function getCentralRestUrl(): string {
  const explicit = process.env["CENTRAL_SUPABASE_URL"];
  if (explicit) return explicit.replace(/\/+$/, "");

  const raw = process.env["EXTERNAL_DB_URL"];
  if (!raw) {
    throw new Error("Banco central não configurado (EXTERNAL_DB_URL ausente).");
  }
  // Formatos possíveis: db.<ref>.supabase.co  |  aws-0-*.pooler.supabase.com (user postgres.<ref>)
  const hostMatch = /@([^:/@]+)/.exec(raw);
  const host = hostMatch?.[1] ?? "";
  const direct = /^db\.([a-z0-9]+)\.supabase\.co$/.exec(host);
  if (direct) return `https://${direct[1]}.supabase.co`;

  const pooled = /:\/\/postgres\.([a-z0-9]+):/.exec(raw);
  if (pooled) return `https://${pooled[1]}.supabase.co`;

  throw new Error(
    "Não foi possível descobrir a URL da API do banco central. Configure CENTRAL_SUPABASE_URL.",
  );
}

export function getCentralServiceKey(): string {
  const key = process.env["CENTRAL_SUPABASE_SERVICE_KEY"];
  if (!key) {
    throw new Error(
      "Chave de serviço do banco central ausente (CENTRAL_SUPABASE_SERVICE_KEY).",
    );
  }
  return key;
}

/**
 * Só estes cabeçalhos são repassados. A API do central bloqueia chamadas que
 * "parecem" vir de um navegador quando usam a chave de serviço, então nada de
 * user-agent, sec-fetch-* ou x-client-info.
 */
const ALLOWED = new Set([
  "accept",
  "content-type",
  "prefer",
  "range",
  "range-unit",
  "accept-profile",
  "content-profile",
  "x-upsert",
]);

/**
 * Encaminha uma requisição PostgREST para o projeto central usando a chave de
 * serviço. A autorização do chamador precisa ser verificada ANTES de chamar.
 */
export async function forwardToCentral(
  request: Request,
  targetPath: string,
): Promise<Response> {
  const base = getCentralRestUrl();
  const key = getCentralServiceKey();
  const incoming = new URL(request.url);
  const target = `${base}/${targetPath.replace(/^\/+/, "")}${incoming.search}`;

  const headers = new Headers();
  request.headers.forEach((value, name) => {
    if (ALLOWED.has(name.toLowerCase())) headers.set(name, value);
  });
  headers.set("apikey", key);
  // Um user-agent de navegador faz a API central recusar a chave de serviço.
  headers.set("user-agent", "speedflow-server/1.0");
  headers.set("Authorization", `Bearer ${key}`);
  // Todo o app trabalha no esquema speedflow do banco central (o cliente
  // sempre envia "public"; aqui o valor é sobrescrito).
  if (request.method === "GET" || request.method === "HEAD") {
    headers.set("Accept-Profile", "speedflow");
  } else {
    headers.set("Content-Profile", "speedflow");
    headers.set("Accept-Profile", "speedflow");
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const res = await fetch(target, {
    method: request.method,
    headers,
    body,
  });

  const outHeaders = new Headers();
  res.headers.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (lower === "content-encoding" || lower === "content-length" || lower === "transfer-encoding") return;
    outHeaders.set(name, value);
  });

  return new Response(res.body, { status: res.status, headers: outHeaders });
}
