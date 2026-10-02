import { createFileRoute } from "@tanstack/react-router";
import { RotaPrintDocument } from "@/components/print/RotaPrintDocument";

export const Route = createFileRoute("/_authenticated/imprimir-rota/$routeId")({
  head: () => ({
    meta: [
      { title: "Imprimir rota — SpeedFlow Logistics" },
      { name: "description", content: "Pré-visualização e impressão do detalhamento da rota." },
      { property: "og:title", content: "Imprimir rota — SpeedFlow Logistics" },
      { property: "og:description", content: "Pré-visualização e impressão do detalhamento da rota." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImprimirRotaPage,
});

function ImprimirRotaPage() {
  const { routeId } = Route.useParams();
  return <RotaPrintDocument routeId={routeId} />;
}
