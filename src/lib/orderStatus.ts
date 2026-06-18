import type { Database } from "@/integrations/supabase/types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_aprovacao_comercial: "Aprov. Comercial",
  aguardando_aprovacao_credito: "Aprov. Crédito",
  aguardando_faturamento: "Aguard. Faturamento",
  em_separacao: "Em Separação",
  aguardando_roteirizacao: "Aguard. Roteirização",
  faturado: "Faturado",
  em_transporte: "Em Transporte",
  entregue: "Entregue",
  reprovado_comercial: "Reprov. Comercial",
  reprovado_credito: "Reprov. Crédito",
  cancelado: "Cancelado",
};

export const KANBAN_COLUMNS: OrderStatus[] = [
  "aguardando_aprovacao_comercial",
  "aguardando_aprovacao_credito",
  "aguardando_faturamento",
  "em_separacao",
  "aguardando_roteirizacao",
  "faturado",
  "em_transporte",
  "entregue",
];

export const STATUS_TONE: Record<OrderStatus, string> = {
  aguardando_aprovacao_comercial: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  aguardando_aprovacao_credito: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  aguardando_faturamento: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  em_separacao: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  aguardando_roteirizacao: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  faturado: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  em_transporte: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  entregue: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  reprovado_comercial: "bg-red-500/15 text-red-600 border-red-500/30",
  reprovado_credito: "bg-red-500/15 text-red-600 border-red-500/30",
  cancelado: "bg-muted text-muted-foreground border-border",
};

export function formatCurrency(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}

export type SlaSettings = {
  sla_commercial_approval_hours: number;
  sla_credit_approval_hours: number;
  sla_fulfillment_hours: number;
  sla_delivery_hours: number;
};

export function slaHoursForStatus(
  status: OrderStatus,
  s: SlaSettings | null | undefined,
): number | null {
  if (!s) return null;
  switch (status) {
    case "aguardando_aprovacao_comercial":
      return s.sla_commercial_approval_hours;
    case "aguardando_aprovacao_credito":
      return s.sla_credit_approval_hours;
    case "aguardando_faturamento":
    case "em_separacao":
    case "aguardando_roteirizacao":
      return s.sla_fulfillment_hours;
    case "faturado":
    case "em_transporte":
      return s.sla_delivery_hours;
    default:
      return null;
  }
}

export function isStageLate(
  status: OrderStatus,
  statusSince: string,
  s: SlaSettings | null | undefined,
): boolean {
  const hours = slaHoursForStatus(status, s);
  if (hours == null || hours <= 0) return false;
  const limit = new Date(statusSince).getTime() + hours * 3600_000;
  return Date.now() > limit;
}

