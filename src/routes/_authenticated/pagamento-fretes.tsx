import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Send, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  autorizarPagamentoFrete,
  lancarOrdemNoErp,
  rejeitarCte,
} from "@/lib/frete-pagamento.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/pagamento-fretes")({
  component: PagamentoFretesPage,
  head: () => ({
    meta: [
      { title: "Pagamento de fretes | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Autorize o pagamento dos CT-e auditados e acompanhe o lançamento das ordens no ERP.",
      },
      { property: "og:title", content: "Pagamento de fretes | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Autorização de pagamento de frete e integração das ordens com o ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Cte = Tables<"ctes">;
type Ordem = Tables<"ordens_pagamento_frete">;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ORDEM_TONE: Record<string, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  AUTORIZADO: "bg-blue-500/10 text-blue-600",
  AGUARDANDO_INTEGRACAO_ERP: "bg-amber-500/10 text-amber-600",
  LANCADO_ERP: "bg-emerald-500/10 text-emerald-600",
  ERRO_ERP: "bg-destructive/10 text-destructive",
};

function PagamentoFretesPage() {
  const qc = useQueryClient();
  const autorizar = useServerFn(autorizarPagamentoFrete);
  const lancar = useServerFn(lancarOrdemNoErp);
  const rejeitar = useServerFn(rejeitarCte);

  const [alvo, setAlvo] = useState<Cte | null>(null);
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data: pendentes, isLoading } = useQuery({
    queryKey: ["ctes-para-autorizar"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctes")
        .select("*")
        .in("status", ["APROVADO", "RESOLVIDO"])
        .order("data_emissao", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Cte[];
    },
  });

  const { data: ordens } = useQuery({
    queryKey: ["ordens-pagamento-frete"],
    queryFn: async () => {
      const [o, c] = await Promise.all([
        supabase
          .from("ordens_pagamento_frete")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("ctes").select("id, numero, chave_acesso").limit(2000),
      ]);
      if (o.error) throw o.error;
      if (c.error) throw c.error;
      const map = new Map((c.data ?? []).map((x) => [x.id, x]));
      return (o.data as Ordem[]).map((x) => ({ ...x, cte: map.get(x.cte_id) ?? null }));
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["ctes-para-autorizar"] });
    qc.invalidateQueries({ queryKey: ["ordens-pagamento-frete"] });
    qc.invalidateQueries({ queryKey: ["ctes"] });
    qc.invalidateQueries({ queryKey: ["cte-auditorias"] });
  };

  const doAutorizar = useMutation({
    mutationFn: async () => {
      if (!alvo) throw new Error("Selecione um CT-e");
      return autorizar({
        data: {
          cteId: alvo.id,
          valorAutorizado: valor ? Number(valor) : undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`Pagamento autorizado: ${brl(res.valor_autorizado)}`);
      setAlvo(null);
      setValor("");
      setMotivo("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doRejeitar = useMutation({
    mutationFn: async () => {
      if (!alvo) throw new Error("Selecione um CT-e");
      if (motivo.trim().length < 3) throw new Error("Informe o motivo da rejeição");
      return rejeitar({ data: { cteId: alvo.id, motivo: motivo.trim() } });
    },
    onSuccess: () => {
      toast.success("CT-e rejeitado");
      setAlvo(null);
      setMotivo("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const doLancar = useMutation({
    mutationFn: async (ordemId: string) => lancar({ data: { ordemId } }),
    onSuccess: (res) => {
      toast.success(`Ordem lançada no ERP${res.referencia_erp ? ` (${res.referencia_erp})` : ""}`);
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });

  const colunasCte = useMemo<ColumnDef<Cte>[]>(
    () => [
      {
        id: "numero",
        header: "CT-e",
        accessor: (c) => c.numero ?? "",
        render: (c) => (
          <div>
            <div className="font-medium">{c.numero ?? "—"}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{c.chave_acesso}</div>
          </div>
        ),
      },
      {
        id: "emissao",
        header: "Emissão",
        filterType: "date",
        accessor: (c) => c.data_emissao ?? "",
        render: (c) =>
          c.data_emissao ? new Date(c.data_emissao).toLocaleDateString("pt-BR") : "—",
      },
      {
        id: "valor",
        header: "Frete",
        align: "right",
        filterType: "number",
        accessor: (c) => Number(c.valor_total_frete),
        render: (c) => brl(Number(c.valor_total_frete)),
      },
      { id: "status", header: "Status", accessor: (c) => c.status },
      {
        id: "acoes",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (c) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => {
                setAlvo(c);
                setValor(String(Number(c.valor_total_frete)));
                setMotivo("");
              }}
            >
              <ShieldCheck className="mr-1 h-4 w-4" />
              Autorizar
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  type OrdemRow = NonNullable<typeof ordens>[number];

  const colunasOrdem = useMemo<ColumnDef<OrdemRow>[]>(
    () => [
      {
        id: "cte",
        header: "CT-e",
        accessor: (o) => o.cte?.numero ?? "",
        render: (o) => (
          <div>
            <div className="font-medium">{o.cte?.numero ?? "—"}</div>
            <div className="font-mono text-[10px] text-muted-foreground">
              {o.cte?.chave_acesso ?? o.cte_id}
            </div>
          </div>
        ),
      },
      {
        id: "valor",
        header: "Valor autorizado",
        align: "right",
        filterType: "number",
        accessor: (o) => Number(o.valor_autorizado),
        render: (o) => brl(Number(o.valor_autorizado)),
      },
      {
        id: "autorizado_em",
        header: "Autorizado em",
        filterType: "date",
        accessor: (o) => o.autorizado_em ?? "",
        render: (o) =>
          o.autorizado_em ? new Date(o.autorizado_em).toLocaleString("pt-BR") : "—",
      },
      {
        id: "status",
        header: "Status",
        accessor: (o) => o.status,
        render: (o) => (
          <Badge variant="secondary" className={ORDEM_TONE[o.status] ?? "bg-muted"}>
            {o.status.replaceAll("_", " ")}
          </Badge>
        ),
      },
      { id: "referencia", header: "Ref. ERP", accessor: (o) => o.referencia_erp ?? "—" },
      {
        id: "acoes",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (o) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="outline"
              disabled={o.status === "LANCADO_ERP" || doLancar.isPending}
              onClick={() => doLancar.mutate(o.id)}
            >
              <Send className="mr-1 h-4 w-4" />
              {o.status === "ERRO_ERP" ? "Reenviar" : "Lançar no ERP"}
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [doLancar.isPending],
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pagamento de fretes</h1>
          <p className="text-muted-foreground text-sm">
            Autorize os CT-e auditados e acompanhe o lançamento das ordens no ERP.
          </p>
        </div>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Aguardando autorização</h2>
          <DataTable
            tableKey="ctes-autorizar"
            columns={colunasCte}
            data={pendentes}
            isLoading={isLoading}
            rowKey={(c) => c.id}
            emptyMessage="Nenhum CT-e aguardando autorização."
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Ordens de pagamento</h2>
          <DataTable
            tableKey="ordens-pagamento-frete"
            columns={colunasOrdem}
            data={ordens}
            rowKey={(o) => o.id}
            emptyMessage="Nenhuma ordem de pagamento gerada."
          />
        </section>

        <FilasErpPanel />
      </div>


      <Dialog open={!!alvo} onOpenChange={(o) => !o && setAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizar pagamento</DialogTitle>
            <DialogDescription>
              CT-e {alvo?.numero ?? "—"} · frete cobrado{" "}
              {brl(Number(alvo?.valor_total_frete ?? 0))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label htmlFor="valor-autorizado">Valor a autorizar (R$)</Label>
              <Input
                id="valor-autorizado"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="motivo-rejeicao">Motivo (para rejeitar)</Label>
              <Input
                id="motivo-rejeicao"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: cobrança indevida não acordada"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              disabled={doRejeitar.isPending}
              onClick={() => doRejeitar.mutate()}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Rejeitar
            </Button>
            <Button disabled={doAutorizar.isPending} onClick={() => doAutorizar.mutate()}>
              {doAutorizar.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-1 h-4 w-4" />
              )}
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
