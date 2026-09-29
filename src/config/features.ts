import { getAppEnv } from "./environment";

/** Feature flags: novidades nascem ligadas em teste e desligadas em produção. */
export const FEATURES = {
  /** Menu lateral abre ao passar o mouse e recolhe ao sair (computador). */
  sidebarHoverExpand: { test: true, production: false },
  /** Clique no código do pedido abre o histórico de status do ERP. */
  historicoStatusPedido: { test: true, production: true },
  /** Autorizar pagamento: iguala os pedidos da rota no app aos do ERP. */
  reconciliarPedidosRota: { test: true, production: false },
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureOn(name: FeatureName): boolean {
  return FEATURES[name][getAppEnv()];
}
