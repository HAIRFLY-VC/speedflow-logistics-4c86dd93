import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Link2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/central/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { gravarProvisaoFrete, previewProvisaoFrete } from "@/lib/provisao-frete.functions";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kg = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export function ProvisaoFreteDialog(props: {
  routeId: string | null;
  rotulo: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewProvisaoFrete);
  const gravar = useServerFn(gravarProvisaoFrete);

  const q = useQuery({
    queryKey: ["provisao-frete", props.routeId],
    enabled: props.open && !!props.routeId,
    queryFn: () => preview({ data: { routeId: props.routeId! } }),
    retry: false,
  });

  const m = useMutation({
    mutationFn: () => gravar({ data: { routeId: props.routeId! } }),
    onSuccess: (r) => {
      toast.success(`Provisionamento gravado no ERP: ${brl(r.total)} em ${r.linhas} nota(s).`);
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["provisao-frete"] });
      props.onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const d = q.data;
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Provisionar frete da transportadora</DialogTitle>
          <DialogDescription>
            Rota {props.rotulo}
            {d?.transportadora ? ` · ${d.transportadora.razao_social}` : ""}
            {d?.tabela ? ` · tabela "${d.tabela.nome}"` : ""}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando pela tabela de frete…
          </div>
        )}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        {d && (
          <div className="space-y-3">
            {d.ja_confirmado && (
              <p className="rounded-md border border-border bg-muted p-2 text-xs">
                Esta rota já foi confirmada. Gravar de novo substitui o provisionamento anterior no ERP.
              </p>
            )}
            {d.bloqueios.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {d.bloqueios.map((b) => (
                  <div key={b} className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {b}
                  </div>
                ))}
              </div>
            )}
            <div className="max-h-[50vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b text-left">
                    <th className="p-1">Filial</th>
                    <th className="p-1">NF</th>
                    <th className="p-1">Borderô</th>
                    <th className="p-1">Cliente</th>
                    <th className="p-1">Cidade/UF</th>
                    <th className="p-1 text-right">Peso (kg)</th>
                    <th className="p-1 text-right">Mercadoria</th>
                    <th className="p-1 text-right">Frete</th>
                  </tr>
                </thead>
                <tbody>
                  {d.notas.map((n) => (
                    <tr key={`${n.cod_filial}-${n.nro_nf}-${n.bordero}`} className="border-b">
                      <td className="p-1">{n.cod_filial}</td>
                      <td className="p-1">{n.nro_nf ?? "—"}</td>
                      <td className="p-1">{n.bordero ?? "—"}</td>
                      <td className="p-1">{n.clientes.join(", ")}</td>
                      <td className="p-1">{[n.cidade, n.uf].filter(Boolean).join("/") || "—"}</td>
                      <td className="p-1 text-right tabular-nums">{kg(n.peso)}</td>
                      <td className="p-1 text-right tabular-nums">{brl(n.valor_mercadoria)}</td>
                      <td className="p-1 text-right tabular-nums">
                        {n.vlr_frete == null ? (
                          <span className="text-destructive">praça não encontrada</span>
                        ) : (
                          brl(n.vlr_frete)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-semibold">
                    <td className="p-1" colSpan={7}>Total provisionado</td>
                    <td className="p-1 text-right tabular-nums">{brl(d.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            disabled={!d || d.bloqueios.length > 0 || m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
            Gravar provisionamento no ERP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
