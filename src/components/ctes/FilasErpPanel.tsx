import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarFilasErp, reenviarFilaErp } from "@/lib/frete-aprovacao.functions";

const brl = (v: number) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TONE: Record<string, string> = {
  PENDENTE: "text-muted-foreground",
  PROCESSANDO: "text-amber-600 border-amber-500/40",
  CONCLUIDO: "text-emerald-600 border-emerald-500/40",
  ERRO: "text-destructive border-destructive/40",
};

export function FilasErpPanel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarFilasErp);
  const reenviar = useServerFn(reenviarFilaErp);

  const { data, isLoading } = useQuery({
    queryKey: ["filas-erp"],
    queryFn: async () => await listar({}),
    refetchInterval: 30_000,
  });

  const mReenviar = useMutation({
    mutationFn: async (v: { fila: "valores" | "financeiro"; filaId: string }) =>
      await reenviar({ data: v }),
    onSuccess: () => {
      toast.success("Item reenviado para a fila");
      void qc.invalidateQueries({ queryKey: ["filas-erp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filas de lançamento no ERP</h2>
        {isLoading ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/40 grid grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-2 px-3 py-1.5 text-[11px] font-medium">
          <span>NF-e / filial</span>
          <span className="text-right">Valores</span>
          <span>Status</span>
          <span>Retorno</span>
          <span />
        </div>
        {(data?.valores ?? []).length === 0 ? (
          <div className="text-muted-foreground px-3 py-3 text-xs">
            Nenhum lançamento de valores na fila.
          </div>
        ) : (
          (data?.valores ?? []).map((f) => {
            const total =
              Number(f.vlr_frete) +
              Number(f.vlr_perna) +
              Number(f.vlr_diaria) +
              Number(f.vlr_pernoite) +
              Number(f.vlr_reentrega) +
              Number(f.vlr_descarrego);
            return (
              <div
                key={f.id}
                className="grid grid-cols-[1fr_1fr_1fr_1.4fr_auto] items-center gap-2 border-t px-3 py-1.5 text-xs"
              >
                <span>
                  NF {f.nro_nf ?? "—"}
                  <span className="text-muted-foreground"> · filial {f.cod_filial ?? "—"}</span>
                </span>
                <span className="text-right tabular-nums">{brl(total)}</span>
                <span>
                  <Badge variant="outline" className={TONE[f.status] ?? ""}>
                    {f.status}
                  </Badge>
                </span>
                <span className="text-muted-foreground truncate">
                  {f.ultimo_erro ?? f.referencia_erp ?? "—"}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={f.status === "CONCLUIDO" || mReenviar.isPending}
                  onClick={() => mReenviar.mutate({ fila: "valores", filaId: f.id })}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/40 grid grid-cols-[1.4fr_1fr_1.4fr_auto] gap-2 px-3 py-1.5 text-[11px] font-medium">
          <span>Provisionamento financeiro</span>
          <span>Status</span>
          <span>Retorno</span>
          <span />
        </div>
        {(data?.financeiro ?? []).length === 0 ? (
          <div className="text-muted-foreground px-3 py-3 text-xs">
            Nenhum provisionamento na fila.
          </div>
        ) : (
          (data?.financeiro ?? []).map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-[1.4fr_1fr_1.4fr_auto] items-center gap-2 border-t px-3 py-1.5 text-xs"
            >
              <span className="text-muted-foreground">
                {new Date(f.created_at).toLocaleString("pt-BR")}
              </span>
              <span>
                <Badge variant="outline" className={TONE[f.status] ?? ""}>
                  {f.status}
                </Badge>
              </span>
              <span className="text-muted-foreground truncate">
                {f.ultimo_erro ?? f.referencia_erp ?? "—"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={f.status === "CONCLUIDO" || mReenviar.isPending}
                onClick={() => mReenviar.mutate({ fila: "financeiro", filaId: f.id })}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
