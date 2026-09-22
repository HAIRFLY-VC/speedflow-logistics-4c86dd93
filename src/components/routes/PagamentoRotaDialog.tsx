import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { toast } from "@/lib/toast";
import { mensagemErro } from "@/lib/mensagem-erro";
import { bitrixTaskUrl } from "@/lib/bitrix";
import {
  confirmarPagamentoRotaFn,
  listarPagamentosRota,
  previewPagamentoRota,
} from "@/lib/rota-pagamento.functions";
import {
  MOTIVOS_ADICIONAIS,
  type MotivoAdicional,
  type TipoPagamentoRota,
} from "@/lib/rota-pagamento.types";

import { Button } from "@/components/ui/button";
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

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function PagamentoRotaDialog({
  routeId,
  rotulo,
  valor,
  isAdmin,
  jaConfirmado,
  open,
  onOpenChange,
}: {
  routeId: string | null;
  rotulo: string;
  valor: number;
  isAdmin: boolean;
  jaConfirmado: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewPagamentoRota);
  const confirmar = useServerFn(confirmarPagamentoRotaFn);
  const historico = useServerFn(listarPagamentosRota);

  const [tipo, setTipo] = useState<TipoPagamentoRota>("FRETE");
  const [motivo, setMotivo] = useState<MotivoAdicional>("PERNOITE");
  const [observacao, setObservacao] = useState("");
  const [valorAdicional, setValorAdicional] = useState("");
  const [valorFrete, setValorFrete] = useState("");
  const [valorDebounced, setValorDebounced] = useState(0);

  useEffect(() => {
    if (open) {
      setTipo("FRETE");
      setMotivo("PERNOITE");
      setObservacao("");
      setValorAdicional("");
      setValorFrete(valor > 0 ? String(valor) : "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, routeId]);

  const valorEfetivo = useMemo(() => {
    const texto = tipo === "FRETE" ? valorFrete : valorAdicional;
    const n = Number(texto.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [tipo, valorFrete, valorAdicional]);

  // Pequeno atraso para não refazer o rateio a cada tecla digitada.
  useEffect(() => {
    const t = setTimeout(() => setValorDebounced(valorEfetivo), 350);
    return () => clearTimeout(t);
  }, [valorEfetivo]);

  const previewQ = useQuery({
    queryKey: ["rota-pagamento", "preview", routeId, valorDebounced, tipo, motivo],
    enabled: open && !!routeId && valorDebounced > 0,
    queryFn: () =>
      preview({
        data: {
          routeId: routeId!,
          valor: valorDebounced,
          tipo,
          motivo: tipo === "ADICIONAL" ? motivo : null,
          observacao: observacao || null,
        },
      }),
  });

  const historicoQ = useQuery({
    queryKey: ["rota-pagamento", "historico", routeId],
    enabled: open && !!routeId,
    queryFn: () => historico({ data: { routeId: routeId! } }),
  });

  const enviar = useMutation({
    mutationFn: async () =>
      confirmar({
        data: {
          routeId: routeId!,
          valor: valorEfetivo,
          tipo,
          motivo: tipo === "ADICIONAL" ? motivo : null,
          observacao: observacao.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Pagamento confirmado e enviado para lançamento.");
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["rota-pagamento", "historico", routeId] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(mensagemErro(e, "Não foi possível confirmar o pagamento.")),
  });

  const p = previewQ.data;
  const semFaturamento = (p?.pedidos_sem_faturamento ?? 0) > 0;
  const recalculando = valorEfetivo !== valorDebounced || previewQ.isFetching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-5xl flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar pagamento — {rotulo}</DialogTitle>
          <DialogDescription>
            Confira o detalhamento da rota por filial de faturamento. Nada é enviado antes de você
            clicar em "Confirmar e enviar".
          </DialogDescription>
        </DialogHeader>

        {tipo === "FRETE" && (
          <div className="flex flex-wrap items-end gap-3 rounded-md border bg-muted/30 p-3">
            <div className="grid gap-1">
              <Label className="text-xs">Valor do frete (R$)</Label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                className="h-9 w-36 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums"
                value={valorFrete}
                onChange={(e) => setValorFrete(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Alterar o valor recalcula o rateio por pedido e os totais por filial.
              {recalculando && valorEfetivo > 0 ? " Recalculando..." : ""}
            </p>
          </div>
        )}

        {jaConfirmado && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700">
            Esta rota já teve o pagamento do frete confirmado.
            {isAdmin
              ? " Você pode reenviar o valor do frete (substitui o lançamento anterior) ou lançar um valor adicional."
              : " Somente administradores podem reabrir ou lançar valores adicionais."}
          </div>
        )}

        {jaConfirmado && isAdmin && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={tipo === "FRETE" ? "default" : "outline"}
                onClick={() => setTipo("FRETE")}
              >
                Frete da rota
              </Button>
              <Button
                type="button"
                size="sm"
                variant={tipo === "ADICIONAL" ? "default" : "outline"}
                onClick={() => setTipo("ADICIONAL")}
              >
                Valor adicional
              </Button>
            </div>
            {tipo === "ADICIONAL" && (
              <>
                <div className="grid gap-1">
                  <Label className="text-xs">Motivo</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value as MotivoAdicional)}
                  >
                    {MOTIVOS_ADICIONAIS.map((m) => (
                      <option key={m.valor} value={m.valor}>
                        {m.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs">Valor adicional (R$)</Label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="h-9 w-32 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums"
                    value={valorAdicional}
                    onChange={(e) => setValorAdicional(e.target.value)}
                    placeholder="0,00"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {previewQ.isLoading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando o rateio...
          </div>
        )}
        {previewQ.error && (
          <p className="text-sm text-destructive">
            {mensagemErro(previewQ.error, "Não foi possível calcular o rateio.")}
          </p>
        )}

        {p && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              <span>
                Valor a pagar: <strong className="tabular-nums">{brl(p.valor)}</strong>
              </span>
              <span className="text-muted-foreground">
                Mercadoria: <span className="tabular-nums">{brl(p.valor_mercadoria)}</span>
              </span>
              <span className="text-muted-foreground">{p.total_pedidos} pedido(s)</span>
            </div>

            {semFaturamento && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {p.pedidos_sem_faturamento} pedido(s) ainda sem faturamento. O pagamento só pode ser
                confirmado quando todos os pedidos estiverem faturados.
              </div>
            )}

            {p.filiais.map((f) => (
              <div key={f.cod_filial} className="rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
                  <span>Filial de faturamento {f.cod_filial}</span>
                  <span className="tabular-nums">{brl(f.frete)}</span>
                </div>
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="px-3 py-1 text-left font-medium">Pedido</th>
                      <th className="px-3 py-1 text-left font-medium">Nota fiscal</th>
                      <th className="px-3 py-1 text-left font-medium">Borderô</th>
                      <th className="px-3 py-1 text-left font-medium">Cliente</th>
                      <th className="px-3 py-1 text-right font-medium">Mercadoria</th>
                      <th className="px-3 py-1 text-right font-medium">Frete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.pedidos.map((ped) => (
                      <tr key={ped.cod_pedido} className="border-t">
                        <td className="px-3 py-1 tabular-nums">{ped.cod_pedido}</td>
                        <td className="px-3 py-1 tabular-nums">
                          {ped.nro_nf ?? <span className="text-destructive">sem NF</span>}
                        </td>
                        <td className="px-3 py-1 tabular-nums">
                          {ped.bordero ?? <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-3 py-1">{ped.cliente}</td>
                        <td className="px-3 py-1 text-right tabular-nums">
                          {brl(ped.valor_mercadoria)}
                        </td>
                        <td className="px-3 py-1 text-right tabular-nums">{brl(ped.frete)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            <div className="rounded-md border p-3 text-sm">
              <p className="mb-2 font-semibold">Resumo por filial de faturamento</p>
              {p.filiais.map((f) => (
                <div key={f.cod_filial} className="flex justify-between">
                  <span>Filial {f.cod_filial}</span>
                  <span className="tabular-nums">{brl(f.frete)}</span>
                </div>
              ))}
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{brl(p.valor)}</span>
              </div>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">Observação (opcional)</Label>
              <Textarea
                rows={2}
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Informação adicional para a tarefa de pagamento"
              />
            </div>
          </div>
        )}

        <div className="rounded-md border">
          <div className="border-b bg-muted/40 px-3 py-2 text-sm font-semibold">
            Histórico de pagamentos
          </div>
          {historicoQ.isLoading ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">Carregando...</p>
          ) : (historicoQ.data ?? []).length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              Nenhuma solicitação de pagamento para esta rota.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="px-3 py-1 text-left font-medium">Data</th>
                  <th className="px-3 py-1 text-left font-medium">Quem confirmou</th>
                  <th className="px-3 py-1 text-left font-medium">Tipo</th>
                  <th className="px-3 py-1 text-right font-medium">Valor</th>
                  <th className="px-3 py-1 text-left font-medium">ERP</th>
                  <th className="px-3 py-1 text-left font-medium">Tarefa</th>
                </tr>
              </thead>
              <tbody>
                {(historicoQ.data ?? []).map((h) => {
                  const url = h.tarefa_referencia ? bitrixTaskUrl(h.tarefa_referencia) : null;
                  return (
                    <tr key={h.id} className="border-t">
                      <td className="px-3 py-1">
                        {format(new Date(h.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="px-3 py-1">{h.autorizado_nome ?? "—"}</td>
                      <td className="px-3 py-1">
                        {h.tipo_pagamento === "FRETE" ? "Frete" : `Adicional — ${h.motivo_adicional ?? ""}`}
                        {h.substituida_em && (
                          <span className="ml-1 text-muted-foreground">(substituído)</span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-right tabular-nums">{brl(h.valor)}</td>
                      <td className="px-3 py-1">
                        {h.status_erp ?? "—"}
                        {h.erros_erp > 0 && (
                          <span className="ml-1 text-destructive">{h.erros_erp} com erro</span>
                        )}
                      </td>
                      <td className="px-3 py-1">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-primary underline"
                          >
                            Abrir tarefa no Bitrix <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">Aguardando criação da tarefa</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => enviar.mutate()}
            disabled={
              enviar.isPending ||
              !p ||
              semBordero ||
              valorEfetivo <= 0 ||
              (jaConfirmado && !isAdmin)
            }
          >
            {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {tipo === "ADICIONAL" ? "Lançar adicional" : "Confirmar Pgto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
