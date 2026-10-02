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
  // Rotas com borderô já emitido migram para a tela de autorização de pagamento;
  // se nenhum pedido tem borderô ainda, a rota continua aqui.
  const filtro = useCallback(
    (r: RouteRow, ctx: { bordero: { comBordero: number } }) =>
      !r.bordero_emitido_em || ctx.bordero.comBordero === 0,
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
