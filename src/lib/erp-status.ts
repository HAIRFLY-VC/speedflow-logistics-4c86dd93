/**
 * Status críticos do ERP que devem aparecer em destaque (fonte vermelha).
 * Comparação normalizada: ignora espaços nas pontas e diferenciar maiúsculas.
 */
const STATUS_CRITICOS = new Set(["01-DIGITADO", "02-CRITICADO"]);

export function isStatusCriticoErp(status: string | null | undefined): boolean {
  if (!status) return false;
  return STATUS_CRITICOS.has(status.trim().toUpperCase());
}
