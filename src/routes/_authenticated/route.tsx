import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    // getSession() lê do storage local (instantâneo), diferente de getUser()
    // que faz uma requisição de rede a cada navegação.
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } as never });
    }
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
