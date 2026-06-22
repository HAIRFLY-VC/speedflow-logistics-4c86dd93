import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SpeedFlow Logistics — Hairfly Cosméticos" },
      {
        name: "description",
        content:
          "Otimize o ciclo do pedido de venda até a entrega: aprovações, faturamento, rotas e canhotos em um só lugar.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
        Carregando...
      </div>
    );
  }
  return user ? <Navigate to="/dashboard" /> : <Navigate to="/auth" />;
}
