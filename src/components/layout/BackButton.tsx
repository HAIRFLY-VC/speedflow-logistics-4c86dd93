import { useEffect, useState } from "react";
import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV } from "@/lib/menu-items";

/** Histórico em memória dos caminhos visitados (para rotular o "Voltar"). */
let lastPath: string | null = null;
let prevPath: string | null = null;
let installed = false;

function install(router: ReturnType<typeof useRouter>) {
  if (installed) return;
  installed = true;
  lastPath = router.state.location.pathname;
  router.subscribe("onResolved", (e) => {
    const p = e.toLocation.pathname;
    if (p !== lastPath) {
      prevPath = lastPath;
      lastPath = p;
    }
  });
}

/** Chamar no layout comum para começar a registrar as telas visitadas. */
export function useTrackNavigation() {
  const router = useRouter();
  useEffect(() => install(router), [router]);
}

function labelFor(path: string | null): string | null {
  if (!path) return null;
  const clean = path.replace(/\/+$/, "") || "/";
  const item = NAV.find((i) => i.url === clean);
  if (item) return item.title;
  if (clean.startsWith("/pedidos/")) return "Pedido";
  if (clean.startsWith("/rotas/")) return "Rota";
  if (clean.startsWith("/ctes/")) return "CT-e";
  return null;
}

interface Props {
  fallbackTo: string;
  fallbackLabel: string;
  className?: string;
}

/** Volta para a tela que abriu a atual; sem histórico, vai para fallbackTo. */
export function BackButton({ fallbackTo, fallbackLabel, className }: Props) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    install(router);
    setLabel(labelFor(prevPath));
  }, [router]);

  if (canGoBack) {
    return (
      <Button variant="ghost" size="sm" className={className} onClick={() => router.history.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        {label ? `Voltar para ${label}` : "Voltar"}
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="sm" className={className}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Link to={fallbackTo as any}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        Voltar para {fallbackLabel}
      </Link>
    </Button>
  );
}
