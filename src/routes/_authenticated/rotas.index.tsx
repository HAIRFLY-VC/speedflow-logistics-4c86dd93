import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { RotasView, type RouteRow } from "@/components/routes/RotasView";

export const Route = createFileRoute("/_authenticated/rotas/")({
  head: () => ({
    meta: [
      { title: "Rotas Pendentes — SpeedFlow Logistics" },
      { name: "description", content: "Consulte e atualize as rotas pendentes do SpeedFlow Logistics." },
      { property: "og:title", content: "Rotas Pendentes — SpeedFlow Logistics" },
      { property: "og:description", content: "Consulte e atualize as rotas pendentes do SpeedFlow Logistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RotasPage,
});

function RotasPage() {
  // Rotas com borderô emitido em TODOS os pedidos migram para a tela de
  // autorização de pagamento; borderô parcial (ou nenhum) mantém a rota aqui.
  const filtro = useCallback(
    (r: RouteRow, ctx: { bordero: { total: number; comBordero: number; semSaida?: number } }) =>
      !r.bordero_emitido_em ||
      ctx.bordero.comBordero < ctx.bordero.total ||
      // Nenhum pedido expedido ainda: a rota continua pendente.
      (ctx.bordero.total > 0 && (ctx.bordero.semSaida ?? 0) === ctx.bordero.total),
    [],
  );

  return (
    <RotasView
      tableKey="rotas"
      titulo="Rotas Pendentes"
      descricao="Planeje rotas, atribua pedidos faturados e emita o borderô."
      mostrarAcoesDeRota
      somenteStatusP
      filtro={filtro}
    />
  );
}
