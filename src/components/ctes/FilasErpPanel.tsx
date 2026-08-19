import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listarFilasErp, reenviarFilaErp } from "@/lib/frete-aprovacao.functions";

const brl = (v: number) =>
  Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const TONE: Record<string, string> = {
  PENDENTE: "text-muted-foreground",
  PROCESSANDO: "text-amber-600 border-amber-500/40",
  CONCLUIDO: "text-emerald-600 border-emerald-500/40",
  ERRO: "text-destructive border-destructive/40",
};

const ROTULO: Record<string, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Processando",
  CONCLUIDO: "Concluído",
  ERRO: "Erro",
};

type ItemValores = {
  id: string;
  cte_id: string | null;
  cte_numero: string | null;
  cte_chave: string | null;
  cod_filial: string | number | null;
  nro_nf: string | number | null;
  status: string;
  tentativas: number | null;
  ultimo_erro: string | null;
  referencia_erp: string | null;
  processado_em: string | null;
  created_at: string;
  vlr_frete: number | null;
  vlr_perna: number | null;
  vlr_diaria: number | null;
  vlr_pernoite: number | null;
  vlr_reentrega: number | null;
  vlr_descarrego: number | null;
};

function consolidar(itens: { status: string }[]): string {
  if (itens.some((i) => i.status === "ERRO")) return "ERRO";
  if (itens.some((i) => i.status === "PROCESSANDO")) return "PROCESSANDO";
  if (itens.every((i) => i.status === "CONCLUIDO")) return "CONCLUIDO";
  return "PENDENTE";
}

const dataHora = (v: string | null) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

export function FilasErpPanel() {
  const qc = useQueryClient();
  const listar = useServerFn(listarFilasErp);
  const reenviar = useServerFn(reenviarFilaErp);

  const { data, isLoading } = useQuery({
    queryKey: ["filas-erp"],
    queryFn: async () => await listar({}),
    refetchInterval: (q) => {
      const d = q.state.data as { valores?: { status: string }[] } | undefined;
      const emAndamento = (d?.valores ?? []).some(
        (v) => v.status === "PENDENTE" || v.status === "PROCESSANDO",
      );
      return emAndamento ? 15_000 : 60_000;
    },
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

  const grupos = useMemo(() => {
    const mapa = new Map<string, { numero: string | null; chave: string | null; itens: ItemValores[] }>();
    for (const item of (data?.valores ?? []) as ItemValores[]) {
      const chave = item.cte_id ?? item.id;
      const atual = mapa.get(chave) ?? {
        numero: item.cte_numero,
        chave: item.cte_chave,
        itens: [] as ItemValores[],
      };
      atual.itens.push(item);
      mapa.set(chave, atual);
    }
    return Array.from(mapa.entries());
  }, [data]);

  const financeiroConfigurado = data?.fluxos?.financeiroConfigurado ?? false;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Filas de lançamento no ERP</h2>
        {isLoading ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
      </div>

      <div className="space-y-3">
        {grupos.length === 0 ? (
          <div className="text-muted-foreground rounded-md border px-3 py-3 text-xs">
            Nenhum lançamento de valores na fila.
          </div>
        ) : (
          grupos.map(([chave, grupo]) => {
            const statusGrupo = consolidar(grupo.itens);
            const comErro = grupo.itens.filter((i) => i.status === "ERRO");
            return (
              <div key={chave} className="rounded-md border">
                <div className="bg-muted/40 flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="text-xs font-medium">
                    CT-e {grupo.numero ?? "—"}
                    {grupo.chave ? (
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {" "}
                        · {grupo.chave}
                      </span>
                    ) : null}
                  </span>
                  <Badge variant="outline" className={TONE[statusGrupo] ?? ""}>
                    {ROTULO[statusGrupo] ?? statusGrupo}
                  </Badge>
                  <span className="text-muted-foreground text-[11px]">
                    {grupo.itens.length} NF-e
                  </span>
                  {comErro.length > 0 ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto h-7 text-xs"
                      disabled={mReenviar.isPending}
                      onClick={() =>
                        comErro.forEach((i) =>
                          mReenviar.mutate({ fila: "valores", filaId: i.id }),
                        )
                      }
                    >
                      <RefreshCw className="mr-1 h-3.5 w-3.5" />
                      Reenviar todos com erro
                    </Button>
                  ) : null}
                </div>

                <div className="text-muted-foreground grid grid-cols-[1.2fr_0.9fr_0.9fr_0.6fr_1.4fr_auto] gap-2 border-t px-3 py-1.5 text-[11px] font-medium">
                  <span>NF-e / filial</span>
                  <span className="text-right">Valor enviado</span>
                  <span>Status</span>
                  <span className="text-right">Tent.</span>
                  <span>Retorno</span>
                  <span />
                </div>

                {grupo.itens.map((f) => {
                  const total =
                    Number(f.vlr_frete ?? 0) +
                    Number(f.vlr_perna ?? 0) +
                    Number(f.vlr_diaria ?? 0) +
                    Number(f.vlr_pernoite ?? 0) +
                    Number(f.vlr_reentrega ?? 0) +
                    Number(f.vlr_descarrego ?? 0);
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.6fr_1.4fr_auto] items-center gap-2 border-t px-3 py-1.5 text-xs"
                    >
                      <span>
                        NF {f.nro_nf ?? "—"}
                        <span className="text-muted-foreground"> · filial {f.cod_filial ?? "—"}</span>
                      </span>
                      <span className="text-right tabular-nums">{brl(total)}</span>
                      <span>
                        <Badge variant="outline" className={TONE[f.status] ?? ""}>
                          {ROTULO[f.status] ?? f.status}
                        </Badge>
                      </span>
                      <span className="text-right tabular-nums">{f.tentativas ?? 0}</span>
                      <span className="text-muted-foreground truncate">
                        {f.ultimo_erro ?? f.referencia_erp ?? "—"}
                        <span className="block text-[10px]">{dataHora(f.processado_em)}</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Reenviar"
                        disabled={f.status !== "ERRO" || mReenviar.isPending}
                        onClick={() => mReenviar.mutate({ fila: "valores", filaId: f.id })}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/40 flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-xs font-medium">Provisionamento financeiro</span>
          {financeiroConfigurado ? null : (
            <Badge variant="outline" className="text-amber-600 border-amber-500/40">
              Aguardando configuração do workflow
            </Badge>
          )}
        </div>
        {!financeiroConfigurado ? (
          <div className="text-muted-foreground flex items-start gap-2 border-t px-3 py-3 text-xs">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              O workflow financeiro do n8n ainda não está configurado. Os registros abaixo ficam
              aguardando e não impedem a conclusão do lançamento de valores — o provisionamento
              precisa ser feito manualmente por enquanto.
            </span>
          </div>
        ) : null}
        {(data?.financeiro ?? []).length === 0 ? (
          <div className="text-muted-foreground border-t px-3 py-3 text-xs">
            Nenhum provisionamento na fila.
          </div>
        ) : (
          (data?.financeiro ?? []).map((f) => (
            <div
              key={f.id}
              className="grid grid-cols-[1.4fr_1fr_1.4fr_auto] items-center gap-2 border-t px-3 py-1.5 text-xs"
            >
              <span>
                CT-e {f.cte_numero ?? "—"}
                <span className="text-muted-foreground block text-[10px]">
                  {new Date(f.created_at).toLocaleString("pt-BR")}
                </span>
              </span>
              <span>
                <Badge variant="outline" className={TONE[f.status] ?? ""}>
                  {ROTULO[f.status] ?? f.status}
                </Badge>
              </span>
              <span className="text-muted-foreground truncate">
                {f.ultimo_erro ? (
                  f.ultimo_erro
                ) : bitrixTaskUrl(f.referencia_erp) ? (
                  <a
                    href={bitrixTaskUrl(f.referencia_erp)!}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary inline-flex items-center gap-1 underline underline-offset-2"
                  >
                    Tarefa {extrairTarefaBitrix(f.referencia_erp)} no Bitrix
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  (f.referencia_erp ?? "—")
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                title="Reenviar"
                disabled={f.status !== "ERRO" || !financeiroConfigurado || mReenviar.isPending}
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
