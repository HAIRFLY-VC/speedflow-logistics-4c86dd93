import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database, Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import { listClientesExternos } from "@/lib/external-catalog.functions";
import type { ExternalCliente } from "@/lib/external-catalog.types";

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});



function formatCnpj(v: string | null) {
  if (!v) return "—";
  const d = v.replace(/\D/g, "");
  if (d.length !== 14) return v;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function ClientesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // debounce simples
  useMemo(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["clientes-externos", debouncedSearch],
    queryFn: () => listClientesExternos({ data: { search: debouncedSearch, limit: 300 } }),
  });

  const columns = useMemo<ColumnDef<ExternalCliente>[]>(
    () => [
      {
        id: "cod_cliente",
        header: "Código",
        accessor: (c) => c.cod_cliente,
        className: "font-mono text-xs",
      },
      {
        id: "name",
        header: "Cliente",
        accessor: (c) => c.razao_social ?? c.nome_fantasia ?? "",
        render: (c) => (
          <div>
            <div className="font-medium">{c.nome_fantasia || c.razao_social || "—"}</div>
            {c.nome_fantasia && c.razao_social ? (
              <div className="text-xs text-muted-foreground">{c.razao_social}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "cnpj",
        header: "CNPJ",
        accessor: (c) => c.cnpj ?? "",
        render: (c) => formatCnpj(c.cnpj),
        className: "font-mono text-xs",
      },
      {
        id: "cidade",
        header: "Cidade/UF",
        accessor: (c) =>
          c.endereco_cidade ? `${c.endereco_cidade}${c.endereco_uf ? "/" + c.endereco_uf : ""}` : "",
      },
      {
        id: "canal",
        header: "Canal",
        accessor: (c) => c.nome_canal ?? "",
        render: (c) => (
          <div>
            <div className="text-sm">{c.nome_canal || "—"}</div>
            {c.nome_grp_emp ? (
              <div className="text-xs text-muted-foreground">{c.nome_grp_emp}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "status",
        header: "Status",
        align: "center",
        accessor: (c) => c.status_cli ?? "",
        render: (c) => (
          <Badge variant={c.status_cli === "A" || c.status_cli === "Ativo" ? "default" : "secondary"}>
            {c.status_cli || "—"}
          </Badge>
        ),
      },
    ],
    [],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground text-sm">
              Cadastro lido diretamente do banco central. Somente leitura.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <Database className="h-3 w-3" />
              Banco central
              {data ? ` · ${data.total.toLocaleString("pt-BR")} clientes` : ""}
            </Badge>
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por razão social, fantasia, CNPJ, código ou cidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : null}

        {data?.truncated ? (
          <p className="text-xs text-muted-foreground">
            Exibindo os primeiros {data.rows.length} registros. Refine a busca para ver outros
            clientes.
          </p>
        ) : null}

        <DataTable
          tableKey="clientes"
          columns={columns}
          data={data?.rows}
          isLoading={isLoading}
          rowKey={(c) => c.cod_cliente}
          emptyMessage="Nenhum cliente encontrado."
          defaultSort={{ id: "name", dir: "asc" }}
        />
      </div>
    </AppShell>
  );
}
