import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";

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

  const columns = useMemo<ColumnDef<Manifest>[]>(
    () => [
      {
        id: "code",
        header: "Código",
        accessor: (m) => m.code,
        className: "font-mono text-xs",
      },
      {
        id: "route_code",
        header: "Rota",
        accessor: (m) => m.routes?.code ?? "",
        render: (m) =>
          m.routes ? (
            <Link
              to="/rotas/$routeId"
              params={{ routeId: m.routes.id }}
              className="text-primary hover:underline font-mono text-xs"
            >
              {m.routes.code}
            </Link>
          ) : (
            "—"
          ),
      },
      {
        id: "route_date",
        header: "Data da rota",
        accessor: (m) => m.routes?.route_date ?? "",
        render: (m) =>
          m.routes?.route_date
            ? format(new Date(m.routes.route_date), "dd/MM/yyyy", { locale: ptBR })
            : "—",
      },
      {
        id: "carrier",
        header: "Fretista",
        accessor: (m) =>
          `${m.routes?.freight_carriers?.full_name ?? ""} ${m.routes?.freight_carriers?.vehicle_plate ?? ""}`,
        render: (m) => (
          <>
            {m.routes?.freight_carriers?.full_name || "—"}
            {m.routes?.freight_carriers?.vehicle_plate ? (
              <span className="text-xs text-muted-foreground">
                {" · "}
                {m.routes.freight_carriers.vehicle_plate}
              </span>
            ) : null}
          </>
        ),
      },
      {
        id: "issued_at",
        header: "Emitido em",
        accessor: (m) => m.issued_at,
        render: (m) =>
          format(new Date(m.issued_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        className: "text-xs text-muted-foreground",
      },
    ],
    [],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Borderôs</h1>
          <p className="text-muted-foreground text-sm">
            Comprovantes emitidos para as rotas de entrega.
          </p>
        </div>

        <DataTable
          tableKey="borderos"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(m) => m.id}
          emptyMessage="Nenhum borderô emitido."
          defaultSort={{ id: "issued_at", dir: "desc" }}
        />
      </div>
    </AppShell>
  );
}
