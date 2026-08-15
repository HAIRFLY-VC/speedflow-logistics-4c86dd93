import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, PlayCircle, ScanSearch, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import {
  auditarCte,
  auditarPendentes,
  resolverDivergencia,
} from "@/lib/cte-audit.functions";
import { salvarToleranciasAuditoria } from "@/lib/frete-pagamento.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/auditoria-fretes")({
  component: AuditoriaFretesPage,
  head: () => ({
    meta: [
      { title: "Auditoria de fretes | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Compare o frete cobrado no CT-e com a tabela de preço contratada e trate as divergências.",
      },
      { property: "og:title", content: "Auditoria de fretes | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Central de auditoria de CT-e com resultado, diferenças e tratativas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Auditoria = Tables<"cte_auditorias">;
type Cte = Tables<"ctes">;
type Divergencia = Tables<"cte_divergencias">;

type Row = Auditoria & { cte: Cte | null; divergencia: Divergencia | null };

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function AuditoriaFretesPage() {
  const qc = useQueryClient();
  const runOne = useServerFn(auditarCte);
  const runAll = useServerFn(auditarPendentes);
  const resolver = useServerFn(resolverDivergencia);
  const salvarTolerancias = useServerFn(salvarToleranciasAuditoria);
  const [selected, setSelected] = useState<Row | null>(null);
  const [tolOpen, setTolOpen] = useState(false);
  const [tolValor, setTolValor] = useState("");
  const [tolPerc, setTolPerc] = useState("");
  const [obs, setObs] = useState("");
  const [valorAcordado, setValorAcordado] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cte-auditorias"],
    queryFn: async () => {
      const [aud, ctes, divs] = await Promise.all([
        supabase
          .from("cte_auditorias")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase.from("ctes").select("*").limit(2000),
        supabase.from("cte_divergencias").select("*").limit(2000),
      ]);
      if (aud.error) throw aud.error;
      if (ctes.error) throw ctes.error;
      if (divs.error) throw divs.error;
      const cteMap = new Map((ctes.data as Cte[]).map((c) => [c.id, c]));
      const divMap = new Map<string, Divergencia>();
      (divs.data as Divergencia[]).forEach((d) => {
        if (!divMap.has(d.cte_id) || d.status !== "RESOLVIDA") divMap.set(d.cte_id, d);
      });
      return (aud.data as Auditoria[]).map<Row>((a) => ({
        ...a,
        cte: cteMap.get(a.cte_id) ?? null,
        divergencia: divMap.get(a.cte_id) ?? null,
      }));
    },
  });

  const { data: config } = useQuery({
    queryKey: ["config-auditoria-frete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configuracoes_auditoria_frete")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const salvarTol = useMutation({
    mutationFn: async () =>
      salvarTolerancias({
        data: {
          toleranciaValor: Number(tolValor || 0),
          toleranciaPercentual: Number(tolPerc || 0),
        },
      }),
    onSuccess: () => {
      toast.success("Tolerâncias atualizadas");
      setTolOpen(false);
      qc.invalidateQueries({ queryKey: ["config-auditoria-frete"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resumo = useMemo(() => {
    const rows = data ?? [];
    const divergentes = rows.filter((r) => r.resultado === "DIVERGENTE");
    return {
      total: rows.length,
      ok: rows.length - divergentes.length,
      divergentes: divergentes.length,
      valorDivergente: divergentes.reduce((s, r) => s + Number(r.diferenca), 0),
    };
  }, [data]);

  const auditAll = useMutation({
    mutationFn: async () => runAll({ data: undefined }),
    onSuccess: (res) => {
      toast.success(
        `${res.total} CT-e auditado(s): ${res.ok} conforme, ${res.divergentes} divergente(s)`,
      );
      res.erros.slice(0, 3).forEach((e) => toast.error(e));
      qc.invalidateQueries({ queryKey: ["cte-auditorias"] });
      qc.invalidateQueries({ queryKey: ["ctes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reaudit = useMutation({
    mutationFn: async (cteId: string) => runOne({ data: { cteId } }),
    onSuccess: (res) => {
      toast.success(
        res.resultado === "OK"
          ? "CT-e conforme a tabela"
          : `Divergência de ${brl(res.diferenca)}`,
      );
      qc.invalidateQueries({ queryKey: ["cte-auditorias"] });
      qc.invalidateQueries({ queryKey: ["ctes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tratar = useMutation({
    mutationFn: async (status: "EM_NEGOCIACAO" | "RESOLVIDA") => {
      if (!selected?.divergencia) throw new Error("Sem divergência aberta");
      return resolver({
        data: {
          divergenciaId: selected.divergencia.id,
          status,
          observacao: obs || undefined,
          valorAcordado: valorAcordado ? Number(valorAcordado) : undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tratativa registrada");
      setSelected(null);
      setObs("");
      setValorAcordado("");
      qc.invalidateQueries({ queryKey: ["cte-auditorias"] });
      qc.invalidateQueries({ queryKey: ["ctes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Row>[]>(
    () => [
      {
        id: "cte",
        header: "CT-e",
        accessor: (r) => r.cte?.numero ?? "",
        render: (r) => (
          <div>
            <div className="font-medium">{r.cte?.numero ?? "—"}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {r.cte?.chave_acesso ?? r.cte_id}
            </div>
          </div>
        ),
      },
      {
        id: "data",
        header: "Auditado em",
        filterType: "date",
        accessor: (r) => r.created_at,
        render: (r) => new Date(r.created_at).toLocaleString("pt-BR"),
      },
      {
        id: "esperado",
        header: "Esperado",
        align: "right",
        filterType: "number",
        accessor: (r) => Number(r.valor_esperado_total),
        render: (r) => brl(Number(r.valor_esperado_total)),
      },
      {
        id: "cobrado",
        header: "Cobrado",
        align: "right",
        filterType: "number",
        accessor: (r) => Number(r.valor_cobrado_total),
        render: (r) => brl(Number(r.valor_cobrado_total)),
      },
      {
        id: "diferenca",
        header: "Diferença",
        align: "right",
        filterType: "number",
        accessor: (r) => Number(r.diferenca),
        render: (r) => (
          <span
            className={
              Number(r.diferenca) > 0
                ? "font-medium text-destructive"
                : "font-medium text-emerald-600"
            }
          >
            {brl(Number(r.diferenca))}
          </span>
        ),
      },
      {
        id: "percentual",
        header: "%",
        align: "right",
        filterType: "number",
        accessor: (r) => Number(r.percentual_diferenca),
        render: (r) => `${Number(r.percentual_diferenca).toFixed(2)}%`,
      },
      {
        id: "resultado",
        header: "Resultado",
        accessor: (r) => r.resultado,
        render: (r) => (
          <Badge
            variant="secondary"
            className={
              r.resultado === "OK"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-destructive/10 text-destructive"
            }
          >
            {r.resultado}
          </Badge>
        ),
      },
      {
        id: "divergencia",
        header: "Tratativa",
        accessor: (r) => r.divergencia?.status ?? "—",
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (r) => (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(r);
                setObs(r.divergencia?.observacao_operador ?? "");
                setValorAcordado(
                  r.divergencia?.valor_acordado != null
                    ? String(r.divergencia.valor_acordado)
                    : "",
                );
              }}
            >
              Detalhes
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Reauditar"
              disabled={reaudit.isPending}
              onClick={() => reaudit.mutate(r.cte_id)}
            >
              <PlayCircle className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reaudit.isPending],
  );

  const detalhes = (selected?.detalhamento ?? []) as {
    nome: string;
    esperado: number;
    cobrado: number | null;
  }[];

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Auditoria de fretes</h1>
            <p className="text-muted-foreground text-sm">
              Confronto entre o frete cobrado no CT-e e a tabela de preço contratada.
            </p>
          </div>
          <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setTolValor(String(Number(config?.tolerancia_valor ?? 0)));
              setTolPerc(String(Number(config?.tolerancia_percentual ?? 0)));
              setTolOpen(true);
            }}
          >
            <SlidersHorizontal className="mr-1 h-4 w-4" />
            Tolerâncias
          </Button>
          <Button disabled={auditAll.isPending} onClick={() => auditAll.mutate()}>
            {auditAll.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="mr-1 h-4 w-4" />
            )}
            Auditar pendentes
          </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Auditorias</div>
            <div className="text-xl font-bold">{resumo.total}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Conformes</div>
            <div className="text-xl font-bold text-emerald-600">{resumo.ok}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Divergentes</div>
            <div className="text-xl font-bold text-destructive">{resumo.divergentes}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground text-xs">Diferença acumulada</div>
            <div className="text-xl font-bold">{brl(resumo.valorDivergente)}</div>
          </div>
        </div>

        <DataTable
          tableKey="cte-auditorias"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyMessage="Nenhuma auditoria executada."
          defaultSort={{ id: "data", dir: "desc" }}
        />
      </div>

      <Dialog open={tolOpen} onOpenChange={setTolOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolerâncias da auditoria</DialogTitle>
            <DialogDescription>
              O CT-e é considerado conforme quando a diferença fica dentro de qualquer uma das
              tolerâncias abaixo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="tol-valor">Tolerância em R$</Label>
              <Input
                id="tol-valor"
                inputMode="decimal"
                value={tolValor}
                onChange={(e) => setTolValor(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="tol-perc">Tolerância em %</Label>
              <Input
                id="tol-perc"
                inputMode="decimal"
                value={tolPerc}
                onChange={(e) => setTolPerc(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={salvarTol.isPending} onClick={() => salvarTol.mutate()}>
              {salvarTol.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhamento da auditoria</DialogTitle>
            <DialogDescription>
              CT-e {selected?.cte?.numero ?? "—"} · {selected?.cte?.chave_acesso}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-md border">
              <div className="grid grid-cols-3 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Componente</span>
                <span className="text-right">Esperado</span>
                <span className="text-right">Cobrado</span>
              </div>
              {detalhes.length === 0 ? (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  Sem detalhamento disponível.
                </div>
              ) : (
                detalhes.map((d) => (
                  <div key={d.nome} className="grid grid-cols-3 px-3 py-2 text-sm">
                    <span>{d.nome}</span>
                    <span className="text-right">{brl(Number(d.esperado))}</span>
                    <span className="text-right">
                      {d.cobrado == null ? "—" : brl(Number(d.cobrado))}
                    </span>
                  </div>
                ))
              )}
              <div className="grid grid-cols-3 border-t px-3 py-2 text-sm font-medium">
                <span>Total</span>
                <span className="text-right">
                  {brl(Number(selected?.valor_esperado_total ?? 0))}
                </span>
                <span className="text-right">
                  {brl(Number(selected?.valor_cobrado_total ?? 0))}
                </span>
              </div>
            </div>

            {selected?.divergencia ? (
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-sm">
                  <span className="font-medium">Divergência:</span>{" "}
                  {selected.divergencia.motivo}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="valor-acordado">Valor acordado (R$)</Label>
                    <Input
                      id="valor-acordado"
                      inputMode="decimal"
                      value={valorAcordado}
                      onChange={(e) => setValorAcordado(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="obs">Observação do operador</Label>
                  <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} />
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            {selected?.divergencia ? (
              <>
                <Button
                  variant="outline"
                  disabled={tratar.isPending}
                  onClick={() => tratar.mutate("EM_NEGOCIACAO")}
                >
                  Em negociação
                </Button>
                <Button disabled={tratar.isPending} onClick={() => tratar.mutate("RESOLVIDA")}>
                  {tratar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                  Marcar como resolvida
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
