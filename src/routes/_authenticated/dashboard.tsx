import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user, role } = useAuth();
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Bem-vindo, {user?.email}. KPIs e Kanban serão entregues nas próximas etapas.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Status da conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">E-mail: </span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Papel: </span>
              {role ? (
                <span className="font-medium uppercase">{role}</span>
              ) : (
                <span className="text-destructive">
                  Sem papel atribuído. Solicite ao administrador para liberar seu acesso.
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
