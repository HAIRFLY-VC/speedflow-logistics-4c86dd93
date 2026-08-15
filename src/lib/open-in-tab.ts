import type { AnyRouter } from "@tanstack/react-router";

/**
 * Detecta se o app está rodando dentro de um iframe (preview do Lovable).
 * Nesse contexto o armazenamento é particionado pelo navegador, então uma
 * nova aba não enxerga a sessão e o usuário cairia na tela de login.
 */
export function isEmbeddedPreview(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Acesso bloqueado por cross-origin => estamos embutidos.
    return true;
  }
}

/**
 * Abre uma rota interna do app. Fora do preview abre em nova aba;
 * dentro do preview navega na própria tela para preservar a sessão.
 */
export function openAppRoute(router: AnyRouter, path: string): void {
  if (typeof window === "undefined") return;
  if (isEmbeddedPreview()) {
    void router.navigate({ href: path });
    return;
  }
  window.open(`${window.location.origin}${path}`, "_blank", "noopener,noreferrer");
}

/** Alvo de link (`target`) seguro para rotas internas. */
export function appLinkTarget(): "_blank" | undefined {
  return isEmbeddedPreview() ? undefined : "_blank";
}
