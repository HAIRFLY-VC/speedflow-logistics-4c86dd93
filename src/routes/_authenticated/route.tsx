import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    // getSession() lê do storage local (instantâneo), diferente de getUser()
    // que faz uma requisição de rede a cada navegação.
    const { data, error } = await supabase.auth.getSession();
    let session = data.session;
    // Token expirado (ou quase): renova antes de chamar o servidor, senão as
    // chamadas autenticadas falham com "Invalid token".
    const expiraEm = session?.expires_at ? session.expires_at * 1000 : 0;
    if (session && expiraEm - Date.now() < 60_000) {
      const { data: novo } = await supabase.auth.refreshSession();
      session = novo.session ?? null;
    }
    if (error || !session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    return { user: session.user };

  },
  component: () => <Outlet />,
});
