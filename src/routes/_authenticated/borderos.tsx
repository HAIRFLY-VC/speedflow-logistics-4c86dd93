import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/borderos")({
  component: BorderosPage,
});

type Manifest = {
  id: string;
  code: string;
  issued_at: string;
  routes: {
    id: string;
    code: string;
    route_date: string;
    freight_carriers: { full_name: string; vehicle_plate: string | null } | null;
  } | null;
};

function BorderosPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["manifests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_manifests")
        .select(
          "id,code,issued_at,routes(id,code,route_date,freight_carriers(full_name,vehicle_plate))",
        )
        .order("issued_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Manifest[];
    },
  });

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Borderôs</h1>
          <p className="text-muted-foreground text-sm">
            Comprovantes emitidos para as rotas de entrega.
          </p>
        </div>

        <div className="border rounded-lg overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Data da rota</TableHead>
                <TableHead>Fretista</TableHead>
                <TableHead>Emitido em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                    Nenhum borderô emitido.
                  </TableCell>
                </TableRow>
              ) : (
                data!.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-xs">{m.code}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {m.routes ? (
                        <Link
                          to="/rotas/$routeId"
                          params={{ routeId: m.routes.id }}
                          className="text-primary hover:underline"
                        >
                          {m.routes.code}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {m.routes?.route_date
                        ? format(new Date(m.routes.route_date), "dd/MM/yyyy", { locale: ptBR })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {m.routes?.freight_carriers?.full_name || "—"}
                      {m.routes?.freight_carriers?.vehicle_plate ? (
                        <span className="text-xs text-muted-foreground">
                          {" · "}
                          {m.routes.freight_carriers.vehicle_plate}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(m.issued_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
