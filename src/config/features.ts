import { getAppEnv } from "./environment";

/** Feature flags: por decisão do usuário, tudo que está no teste vai para a oficial ao publicar (production: true sempre). */
export const FEATURES = {
  /** Menu lateral abre ao passar o mouse e recolhe ao sair (computador). */
  sidebarHoverExpand: { test: true, production: true },
  /** Clique no código do pedido abre o histórico de status do ERP. */
  historicoStatusPedido: { test: true, production: true },
  /** Autorizar pagamento: iguala os pedidos da rota no app aos do ERP. */
  reconciliarPedidosRota: { test: true, production: true },
  /** Resumo pulsante dos pedidos sem rota na tela de Rotas Pendentes. */
  cardPedidosSemRota: { test: true, production: true },
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureOn(name: FeatureName): boolean {
  return FEATURES[name][getAppEnv()];
}
