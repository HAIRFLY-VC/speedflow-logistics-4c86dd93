import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { RotasView } from "@/components/routes/RotasView";

export const Route = createFileRoute("/_authenticated/autorizar-pagamento-frete")({
  head: () => ({
    meta: [
      { title: "Autorizar pagamento de frete — SpeedFlow Logistics" },
      {
        name: "description",
        content: "Confirme o pagamento do frete das rotas com borderô informado em todos os pedidos.",
      },
      { property: "og:title", content: "Autorizar pagamento de frete — SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Confirme o pagamento do frete das rotas com borderô informado em todos os pedidos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutorizarPagamentoFretePage,
});

function AutorizarPagamentoFretePage() {
  const filtro = useCallback(
    (_r: unknown, ctx: { bordero: { total: number; comBordero: number } }) =>
      ctx.bordero.total > 0 && ctx.bordero.comBordero === ctx.bordero.total,
    [],
  );

  return (
    <RotasView
      tableKey="rotas-autorizar-pagamento"
      titulo="Autorizar pagamento de frete"
      descricao="Rotas com borderô informado em todos os pedidos, prontas para confirmação do pagamento."
      permitirConfirmacao
      filtro={filtro}
      mensagemVazia="Nenhuma rota com borderô completo no momento."
    />
  );
}
