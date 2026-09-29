import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { historicoStatusPedido } from "@/lib/pedido-historico.functions";
import { isFeatureOn } from "@/config/features";

function formatarData(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString("pt-BR");
}

/** Código do pedido clicável: abre o histórico de status do ERP. */
export function PedidoCodigo({
  codigo,
  children,
  className,
}: {
  codigo: string | number | null | undefined;
  children?: ReactNode;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const cod = codigo == null ? "" : String(codigo).trim();
  const buscar = useServerFn(historicoStatusPedido);
  const q = useQuery({
    queryKey: ["historico-status-pedido", cod],
    queryFn: () => buscar({ data: { codPedido: cod } }),
    enabled: aberto && /^\d+$/.test(cod),
    staleTime: 60_000,
  });
  const conteudo = children ?? cod;
  if (!cod || !/^\d+$/.test(cod) || !isFeatureOn("historicoStatusPedido")) {
    return <span className={className}>{conteudo || "—"}</span>;
  }
  return (
    <>
      <button
        type="button"
        title="Ver histórico de status"
        className={`inline-flex items-center gap-1 hover:underline hover:text-primary ${className ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setAberto(true);
        }}
      >
        {conteudo}
        <History className="h-3 w-3 opacity-60" />
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-3xl" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Histórico de status — Pedido {cod}</DialogTitle>
          </DialogHeader>
          {q.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Consultando o ERP...
            </p>
          ) : q.isError ? (
            <div className="space-y-2 text-sm">
              <p className="text-destructive">{(q.error as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => q.refetch()}>
                Tentar de novo
              </Button>
            </div>
          ) : (q.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro de status para este pedido.</p>
          ) : (
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Data/hora</th>
                    <th className="py-1 pr-3">Status</th>
                    <th className="py-1 pr-3">Usuário</th>
                    <th className="py-1">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {q.data!.map((l, i) => (
                    <tr key={i} className="border-t align-top">
                      <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{formatarData(l.dta_entrada)}</td>
                      <td className="py-1 pr-3">{l.status ?? "—"}</td>
                      <td className="py-1 pr-3">{l.usu_entrada ?? "—"}</td>
                      <td className="py-1 whitespace-pre-wrap">{l.obs ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
