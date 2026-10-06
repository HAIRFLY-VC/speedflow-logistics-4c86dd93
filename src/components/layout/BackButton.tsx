import { useEffect, useSyncExternalStore } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV } from "@/lib/menu-items";

/** Histórico em memória dos caminhos visitados nesta sessão do app. */
let stack: string[] = [];
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function install(router: ReturnType<typeof useRouter>) {
  if (installed) return;
  installed = true;
  stack = [router.state.location.pathname];
  router.subscribe("onResolved", (e) => {
    const p = e.toLocation.pathname;
    const top = stack[stack.length - 1];
    if (p === top) return;
    // Voltar do navegador/botão: retira a entrada atual da pilha.
    if (stack.length > 1 && stack[stack.length - 2] === p) stack = stack.slice(0, -1);
    else stack = [...stack, p];
    emit();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
const getPrev = () => (stack.length > 1 ? stack[stack.length - 2] : null);
const getServerPrev = () => null;

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
  if (clean.startsWith("/nfes/")) return "NF-e";
  return null;
}

/** Telas de detalhe que já têm o próprio botão Voltar. */
export function isDetailPath(path: string) {
  return /^\/(pedidos|rotas|ctes|nfes|imprimir-rota)\/[^/]+/.test(path);
}

interface Props {
  fallbackTo?: string;
  fallbackLabel?: string;
  className?: string;
}

/** Volta para a tela que abriu a atual; sem histórico, vai para fallbackTo (ou não aparece). */
export function BackButton({ fallbackTo, fallbackLabel, className }: Props) {
  const router = useRouter();
  const prev = useSyncExternalStore(subscribe, getPrev, getServerPrev);

  if (prev) {
    const label = labelFor(prev);
    return (
      <Button variant="ghost" size="sm" className={className} onClick={() => router.history.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" />
        {label ? `Voltar para ${label}` : "Voltar"}
      </Button>
    );
  }
  if (!fallbackTo) return null;
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
