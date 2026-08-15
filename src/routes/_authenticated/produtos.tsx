import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import { formatCurrency } from "@/lib/orderStatus";
import { listProdutosExternos } from "@/lib/external-catalog.functions";
import type { ExternalProduto } from "@/lib/external-catalog.types";

export const Route = createFileRoute("/_authenticated/produtos")({
  component: ProdutosPage,
});

function isAtivo(v: string | null) {
  if (!v) return false;
  const s = v.trim().toUpperCase();
  return s === "S" || s === "A" || s === "SIM" || s === "ATIVO" || s === "1";
}

function ProdutosPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["produtos-externos"],
    queryFn: () => listProdutosExternos(),
  });

  const columns = useMemo<ColumnDef<ExternalProduto>[]>(
    () => [
      {
        id: "cod_produto",
        header: "Código",
        accessor: (p) => p.cod_produto,
        className: "font-mono text-xs",
      },
      {
        id: "descricao",
        header: "Produto",
        accessor: (p) => p.descricao ?? "",
        render: (p) => <div className="font-medium">{p.descricao || "—"}</div>,
      },
      {
        id: "marca",
        header: "Marca",
        accessor: (p) => p.marca ?? "",
      },
      {
        id: "unidade_medida",
        header: "UN",
        align: "center",
        accessor: (p) => p.unidade_medida ?? "",
      },
      {
        id: "qt_por_caixa",
        header: "Qtd/caixa",
        align: "right",
        accessor: (p) => Number(p.qt_por_caixa ?? 0),
        render: (p) => (p.qt_por_caixa ? Number(p.qt_por_caixa).toLocaleString("pt-BR") : "—"),
        className: "tabular-nums",
      },
      {
        id: "peso_liquido_kg",
        header: "Peso (kg)",
        align: "right",
        accessor: (p) => Number(p.peso_liquido_kg ?? 0),
        render: (p) => (p.peso_liquido_kg ? Number(p.peso_liquido_kg).toFixed(3) : "—"),
        className: "tabular-nums",
      },
      {
        id: "custo",
        header: "Custo ref.",
        align: "right",
        accessor: (p) => Number(p.custo_unitario_referencia ?? 0),
        render: (p) =>
          p.custo_unitario_referencia
            ? formatCurrency(Number(p.custo_unitario_referencia))
            : "—",
        className: "tabular-nums",
      },
      {
        id: "ativo",
        header: "Ativo",
        align: "center",
        accessor: (p) => (isAtivo(p.ativo) ? "sim" : "não"),
        render: (p) => (
          <Badge variant={isAtivo(p.ativo) ? "default" : "secondary"}>
            {isAtivo(p.ativo) ? "Sim" : "Não"}
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
            <h1 className="text-2xl font-bold tracking-tight">Produtos</h1>
            <p className="text-muted-foreground text-sm">
              Catálogo lido diretamente do banco central. Somente leitura.
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Database className="h-3 w-3" />
            Banco central
            {data ? ` · ${data.total.toLocaleString("pt-BR")} produtos` : ""}
          </Badge>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {(error as Error).message}
          </div>
        ) : null}

        <DataTable
          tableKey="produtos"
          columns={columns}
          data={data?.rows}
          isLoading={isLoading}
          rowKey={(p) => p.cod_produto}
          emptyMessage="Nenhum produto encontrado."
          defaultSort={{ id: "descricao", dir: "asc" }}
        />
      </div>
    </AppShell>
  );
}
