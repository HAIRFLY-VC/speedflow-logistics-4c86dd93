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
  /** Impressão do detalhamento da rota (Rotas Pendentes, Autorizar e detalhe). */
  impressaoRota: { test: true, production: true },
  /** Autorizar: provisionamento do frete pela tabela da transportadora (rotas tipo T). */
  provisaoFreteTransportadora: { test: true, production: true },
  /** Card de % do frete do ciclo comercial e painel Custo de Frete. */
  painelCustoFrete: { test: true, production: true },
  /** Números das NF-es referenciadas na listagem principal de CT-e. */
  notasFiscaisNaListaCte: { test: true, production: true },
  /** Endereço completo do destinatário e praça usada no detalhe da NF-e. */
  enderecoPracaDetalheNfe: { test: true, production: true },
  /** Código da rota no ERP na listagem principal de CT-e. */
  rotaNaListaCte: { test: true, production: true },
} as const;

export type FeatureName = keyof typeof FEATURES;

export function isFeatureOn(name: FeatureName): boolean {
  return FEATURES[name][getAppEnv()];
}
