import { createFileRoute } from "@tanstack/react-router";
import { RotasView } from "@/components/routes/RotasView";

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
  return (
    <RotasView
      tableKey="rotas"
      titulo="Rotas Pendentes"
      descricao="Planeje rotas, atribua pedidos faturados e emita o borderô."
      mostrarAcoesDeRota
    />
  );
}
