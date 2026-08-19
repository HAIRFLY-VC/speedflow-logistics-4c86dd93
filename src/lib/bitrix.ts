/** Utilidades para montar links do CRM Bitrix24. */
const BITRIX_BASE = "https://hairfly.bitrix24.com.br";
const BITRIX_USER_ID = "1";

/** Extrai o código numérico da tarefa a partir da referência retornada pelo n8n. */
export function extrairTarefaBitrix(referencia: string | null | undefined): string | null {
  if (!referencia) return null;
  const m = String(referencia).match(/(\d{3,})/);
  return m ? m[1]! : null;
}

/** URL da tarefa no Bitrix24 (ou null quando a referência não é uma tarefa). */
export function bitrixTaskUrl(referencia: string | null | undefined): string | null {
  const id = extrairTarefaBitrix(referencia);
  return id ? `${BITRIX_BASE}/company/personal/user/${BITRIX_USER_ID}/tasks/task/view/${id}/` : null;
}
