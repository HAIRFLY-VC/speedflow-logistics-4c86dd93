/**
 * Criação de tarefas no Bitrix24 direto pelo app (sem n8n).
 *
 * Server-only: usa o webhook de entrada guardado em `BITRIX_WEBHOOK_URL`
 * (formato `https://<conta>.bitrix24.com.br/rest/1/<token>/`).
 *
 * Participantes da tarefa:
 * - Criador: usuário do Bitrix vinculado a quem autorizou o pagamento
 *   (profiles.bitrix_user_id). Sem vínculo, a tarefa não é criada.
 * - Responsável e observadores: configuração salva em `bitrix_task_config`
 *   (tela Configurações). Se vazia, caem nos valores padrão abaixo.
 */
import { centralDb } from "./central-db";

/** Valores usados quando a configuração ainda não foi salva. */
export const TAREFA_RESPONSAVEL_ID = 30;
export const TAREFA_OBSERVADORES = [24, 54, 1];

export type NovaTarefaBitrix = {
  titulo: string;
  descricao: string;
  /** Data limite no formato AAAA-MM-DD (opcional). */
  prazo?: string | null;
  /** Código do usuário do Bitrix que será o criador da tarefa (obrigatório). */
  criadoPorBitrixId: number;
};

export type UsuarioBitrix = {
  id: number;
  nome: string;
  email: string | null;
  cargo: string | null;
};

export type ConfigTarefaBitrix = {
  responsavel_id: number | null;
  responsavel_nome: string | null;
  observadores: { id: number; nome: string }[];
};

export function bitrixConfigurado(): boolean {
  return Boolean(process.env["BITRIX_WEBHOOK_URL"]);
}

function urlMetodo(metodo: string): string {
  const base = process.env["BITRIX_WEBHOOK_URL"];
  if (!base) {
    throw new Error(
      "Integração com o Bitrix não configurada (endereço do webhook ausente).",
    );
  }
  // O endereço pode vir só com o token (`/rest/1/<token>/`) ou já apontando
  // para um método (`/rest/1/<token>/tasks.task.add.json`).
  const limpo = base.trim().replace(/\/+$/, "");
  const ultimo = limpo.split("/").pop() ?? "";
  const raiz = ultimo.includes(".") ? limpo.slice(0, limpo.length - ultimo.length - 1) : limpo;
  return `${raiz}/${metodo}`;
}

async function chamarBitrix(metodo: string, corpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  let resp: Response;
  try {
    resp = await fetch(urlMetodo(metodo), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(corpo),
    });
  } catch (e) {
    throw new Error(`Falha ao contatar o Bitrix: ${(e as Error).message}`);
  }

  const texto = await resp.text();
  let json: Record<string, unknown> = {};
  try {
    json = texto ? (JSON.parse(texto) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Resposta inesperada do Bitrix (${resp.status}): ${texto.slice(0, 300)}`);
  }

  if (json["error"]) {
    const codigo = String(json["error"]);
    const msg = String(json["error_description"] ?? json["error"]);
    if (codigo === "insufficient_scope") {
      throw new Error(
        'O webhook do Bitrix não tem a permissão "Usuários (user)". No Bitrix, em Aplicativos > Webhooks, edite o webhook e marque também "Usuários (user)".',
      );
    }
    throw new Error(`Bitrix recusou: ${msg}`);
  }
  if (!resp.ok) {
    throw new Error(`Bitrix respondeu ${resp.status}: ${texto.slice(0, 300)}`);
  }
  return json;
}

/** Lê a configuração de participantes; sem config, devolve os valores padrão. */
export async function obterConfigTarefa(): Promise<ConfigTarefaBitrix> {
  const { data, error } = await centralDb
    .from("bitrix_task_config" as never)
    .select("responsavel_id, responsavel_nome, observadores")
    .eq("id", 1)
    .maybeSingle();
  // Enquanto o script da tabela não é rodado, usa os valores padrão.
  const codigoErro = (error as { code?: string } | null)?.code ?? "";
  const msgErro = (error as { message?: string } | null)?.message ?? "";
  if (error && (codigoErro === "42P01" || codigoErro === "PGRST205" || msgErro.includes("bitrix_task_config"))) {
    return {
      responsavel_id: TAREFA_RESPONSAVEL_ID,
      responsavel_nome: null,
      observadores: TAREFA_OBSERVADORES.map((id) => ({ id, nome: "" })),
    };
  }
  if (error) throw new Error((error as { message: string }).message);
  const row = (data ?? null) as {
    responsavel_id: number | null;
    responsavel_nome: string | null;
    observadores: { id: number; nome: string }[] | null;
  } | null;
  return {
    responsavel_id: row?.responsavel_id ?? TAREFA_RESPONSAVEL_ID,
    responsavel_nome: row?.responsavel_nome ?? null,
    observadores:
      row?.observadores && row.observadores.length > 0
        ? row.observadores
        : TAREFA_OBSERVADORES.map((id) => ({ id, nome: "" })),
  };
}

/** Usuário do Bitrix vinculado a um usuário do app (null quando não há vínculo). */
export async function vinculoBitrixDoUsuario(
  appUserId: string,
): Promise<{ bitrix_user_id: number; bitrix_user_nome: string | null } | null> {
  const { data, error } = await centralDb
    .from("profiles")
    .select("bitrix_user_id, bitrix_user_nome")
    .eq("id", appUserId)
    .maybeSingle();
  // Enquanto o script das colunas não é rodado, trata como "sem vínculo".
  if (error && (error as { code?: string }).code === "42703") return null;
  if (error) throw new Error(error.message);
  const row = (data ?? null) as { bitrix_user_id: number | null; bitrix_user_nome: string | null } | null;
  if (!row?.bitrix_user_id) return null;
  return { bitrix_user_id: row.bitrix_user_id, bitrix_user_nome: row.bitrix_user_nome };
}

// Cache em memória da lista de usuários (10 min). O worker é stateless, então
// o cache vale apenas dentro da mesma instância — ainda assim evita chamadas
// repetidas durante uma mesma sessão de uso.
let cacheUsuarios: { em: number; lista: UsuarioBitrix[] } | null = null;
const CACHE_USUARIOS_MS = 10 * 60_000;

/** Lista todos os usuários ativos do Bitrix (código, nome, cargo e e-mail). */
export async function listarUsuariosBitrix(): Promise<UsuarioBitrix[]> {
  if (cacheUsuarios && Date.now() - cacheUsuarios.em < CACHE_USUARIOS_MS) {
    return cacheUsuarios.lista;
  }
  const todos: UsuarioBitrix[] = [];
  let start = 0;
  // Paginação do user.get: 50 por página, parâmetro `start`.
  for (let pagina = 0; pagina < 40; pagina += 1) {
    const json = await chamarBitrix("user.get.json", {
      FILTER: { ACTIVE: true },
      start,
    });
    const lote = (json["result"] ?? []) as Record<string, unknown>[];
    for (const u of lote) {
      const nome = [u["NAME"], u["LAST_NAME"]]
        .map((p) => String(p ?? "").trim())
        .filter(Boolean)
        .join(" ");
      todos.push({
        id: Number(u["ID"]),
        nome: nome || `Usuário ${u["ID"]}`,
        email: String(u["EMAIL"] ?? "").trim() || null,
        cargo: String(u["WORK_POSITION"] ?? "").trim() || null,
      });
    }
    const next = json["next"];
    if (typeof next === "number" && lote.length > 0) {
      start = next;
      continue;
    }
    break;
  }
  todos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  cacheUsuarios = { em: Date.now(), lista: todos };
  return todos;
}

/** Cria a tarefa e devolve o código dela no Bitrix. Lança erro com a mensagem do Bitrix. */
export async function criarTarefaBitrix(tarefa: NovaTarefaBitrix): Promise<{ id: string }> {
  const config = await obterConfigTarefa();
  const fields: Record<string, unknown> = {
    TITLE: tarefa.titulo,
    DESCRIPTION: tarefa.descricao,
    CREATED_BY: tarefa.criadoPorBitrixId,
    RESPONSIBLE_ID: config.responsavel_id ?? TAREFA_RESPONSAVEL_ID,
    AUDITORS: config.observadores.map((o) => o.id),
    GROUP_ID: 0,
  };
  if (tarefa.prazo) fields["DEADLINE"] = `${tarefa.prazo} 18:00:00`;

  const json = await chamarBitrix("tasks.task.add.json", { fields });
  const result = (json["result"] ?? {}) as Record<string, unknown>;
  const task = (result["task"] ?? {}) as Record<string, unknown>;
  const id = task["id"] ?? task["ID"] ?? result["id"];
  if (!id) throw new Error("Bitrix não devolveu o código da tarefa.");
  return { id: String(id) };
}
