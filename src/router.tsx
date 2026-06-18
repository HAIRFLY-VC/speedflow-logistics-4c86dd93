import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Dados ficam "fresh" por 30s — evita refetch ao voltar para a página
        staleTime: 30_000,
        // Mantém em memória por 5min após sair da tela
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Pré-carrega rota ao passar o mouse / focar o link
    defaultPreload: "intent",
    defaultPreloadDelay: 50,
    // Deixa o React Query controlar o cache; o router só dispara o preload
    defaultPreloadStaleTime: 0,
  });

  return router;
};
