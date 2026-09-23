/**
 * Criação de tarefas no Bitrix24 direto pelo app (sem n8n).
 *
 * Server-only: usa o webhook de entrada guardado em `BITRIX_WEBHOOK_URL`
 * (formato `https://<conta>.bitrix24.com.br/rest/1/<token>/`).
 */

/** Responsável e observadores padrão das tarefas de pagamento de frete. */
export const TAREFA_RESPONSAVEL_ID = 30;
export const TAREFA_OBSERVADORES = [24, 54, 1];

export type NovaTarefaBitrix = {
  titulo: string;
  descricao: string;
  /** Data limite no formato AAAA-MM-DD (opcional). */
  prazo?: string | null;
};

export function bitrixConfigurado(): boolean {
  return Boolean(process.env["BITRIX_WEBHOOK_URL"]);
}

/** Cria a tarefa e devolve o código dela no Bitrix. Lança erro com a mensagem do Bitrix. */
export async function criarTarefaBitrix(tarefa: NovaTarefaBitrix): Promise<{ id: string }> {
  const base = process.env["BITRIX_WEBHOOK_URL"];
  if (!base) {
    throw new Error(
      "Integração com o Bitrix não configurada (endereço do webhook ausente).",
    );
  }

  // O endereço pode vir só com o token (`/rest/1/<token>/`) ou já apontando
  // para o método (`/rest/1/<token>/tasks.task.add.json`).
  const limpo = base.trim().replace(/\/+$/, "");
  const ultimo = limpo.split("/").pop() ?? "";
  const url = ultimo.includes(".") ? limpo : `${limpo}/tasks.task.add.json`;
  const fields: Record<string, unknown> = {
    TITLE: tarefa.titulo,
    DESCRIPTION: tarefa.descricao,
    RESPONSIBLE_ID: TAREFA_RESPONSAVEL_ID,
    AUDITORS: TAREFA_OBSERVADORES,
    GROUP_ID: 0,
  };
  if (tarefa.prazo) fields["DEADLINE"] = `${tarefa.prazo} 18:00:00`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fields }),
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
    const msg = String(json["error_description"] ?? json["error"]);
    throw new Error(`Bitrix recusou a tarefa: ${msg}`);
  }
  if (!resp.ok) {
    throw new Error(`Bitrix respondeu ${resp.status}: ${texto.slice(0, 300)}`);
  }

  const result = (json["result"] ?? {}) as Record<string, unknown>;
  const task = (result["task"] ?? {}) as Record<string, unknown>;
  const id = task["id"] ?? task["ID"] ?? result["id"];
  if (!id) throw new Error("Bitrix não devolveu o código da tarefa.");
  return { id: String(id) };
}
