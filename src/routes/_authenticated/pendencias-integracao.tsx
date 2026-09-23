import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  History,
} from "lucide-react";
import { toast } from "@/lib/toast";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  historicoPendencia,
  listarPendenciasIntegracao,
  pausarPendencia,
  resolverPendencia,
  tentarPendenciaAgora,
} from "@/lib/fila-pendencias.functions";
import type { ItemPendencia, TentativaHistorico } from "@/lib/fila-pendencias.server";

export const Route = createFileRoute("/_authenticated/pendencias-integracao")({
  component: PendenciasIntegracaoPage,
  head: () => ({
    meta: [
      { title: "Pendências de integração | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Acompanhe e resolva os lançamentos de frete no ERP e as tarefas do Bitrix que ainda não foram concluídos.",
      },
      { property: "og:title", content: "Pendências de integração | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Fila de reenvio automático das integrações de frete com ERP e Bitrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function dataHora(valor: string | null): string {
  if (!valor) return "—";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR");
}

function relativo(valor: string | null): string {
  if (!valor) return "—";
  const alvo = new Date(valor).getTime();
  if (Number.isNaN(alvo)) return "—";
  const min = Math.round((alvo - Date.now()) / 60_000);
  if (min <= 0) return "a qualquer momento";
  if (min < 60) return `em ${min} min`;
  return `em ${Math.round(min / 60)} h`;
}

function StatusBadge({ item }: { item: ItemPendencia }) {
  if (item.resolvida_manual_em) return <Badge variant="secondary">Resolvido manualmente</Badge>;
  if (item.status === "CONCLUIDO") return <Badge variant="secondary">Concluído</Badge>;
  if (item.pausada_em) return <Badge variant="outline">Pausado</Badge>;
  if (item.status === "ERRO") return <Badge variant="destructive">Com erro</Badge>;
  return <Badge variant="outline">Aguardando</Badge>;
}

function PendenciasIntegracaoPage() {
  const qc = useQueryClient();
  const listar = useServerFn(listarPendenciasIntegracao);
  const tentar = useServerFn(tentarPendenciaAgora);
  const pausar = useServerFn(pausarPendencia);
  const resolver = useServerFn(resolverPendencia);
  const historico = useServerFn(historicoPendencia);

  const [incluirResolvidas, setIncluirResolvidas] = useState(false);
  const [resolvendo, setResolvendo] = useState<ItemPendencia | null>(null);
  const [motivo, setMotivo] = useState("");
  const [verHistorico, setVerHistorico] = useState<ItemPendencia | null>(null);

  const consulta = useQuery({
    queryKey: ["pendencias-integracao", incluirResolvidas],
    queryFn: () => listar({ data: { incluirResolvidas } }),
    refetchInterval: 60_000,
    retry: 1,
  });

  const tentativas = useQuery<TentativaHistorico[]>({
    queryKey: ["pendencia-historico", verHistorico?.raiz_id],
    queryFn: () => historico({ data: { raizId: verHistorico!.raiz_id } }),
    enabled: Boolean(verHistorico),
    retry: 1,
  });


  function recarregar() {
    void qc.invalidateQueries({ queryKey: ["pendencias-integracao"] });
  }

  const tentarMut = useMutation({
    mutationFn: (item: ItemPendencia) => tentar({ data: { fila: item.fila, id: item.id } }),
    onSuccess: (r) => {
      if (r?.ok) toast.success("Nova tentativa enviada.");
      else toast.error(r?.erro ?? "A tentativa falhou novamente.");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pausarMut = useMutation({
    mutationFn: ({ item, pausar: p }: { item: ItemPendencia; pausar: boolean }) =>
      pausar({ data: { fila: item.fila, id: item.id, pausar: p } }),
    onSuccess: () => {
      toast.success("Reenvio automático atualizado.");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolverMut = useMutation({
    mutationFn: () =>
      resolver({ data: { fila: resolvendo!.fila, id: resolvendo!.id, motivo: motivo.trim() } }),
    onSuccess: () => {
      toast.success("Pendência marcada como resolvida.");
      setResolvendo(null);
      setMotivo("");
      recarregar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dados = consulta.data;
  const itens = dados?.itens ?? [];

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Pendências de integração</h1>
            <p className="text-sm text-muted-foreground">
              Lançamentos de frete no ERP e tarefas do Bitrix que ainda não foram concluídos. O app
              tenta resolver sozinho a cada poucos minutos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIncluirResolvidas((v) => !v)}
              aria-pressed={incluirResolvidas}
            >
              {incluirResolvidas ? "Ocultar concluídas" : "Mostrar concluídas"}
            </Button>
            <Button variant="outline" size="sm" onClick={recarregar}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes de solução
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{dados?.pendentes ?? 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Com erro</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2 text-2xl font-semibold">
              {dados?.comErro ? (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              )}
              {dados?.comErro ?? 0}
            </CardContent>
          </Card>
        </div>

        {consulta.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando pendências…
          </div>
        ) : itens.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Nenhuma pendência de integração no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {itens.map((item) => {
              const bloqueado = Boolean(item.resolvida_manual_em) || item.status === "CONCLUIDO";
              return (
                <Card key={`${item.fila}-${item.id}`}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge item={item} />
                      <span className="font-medium">{item.destino}</span>
                      {item.rota_codigo ? (
                        <span className="text-sm text-muted-foreground">
                          Rota {item.rota_codigo}
                        </span>
                      ) : null}
                      {item.nro_nf ? (
                        <span className="text-sm text-muted-foreground">
                          NF {item.nro_nf} · Filial {item.cod_filial ?? "—"}
                          {item.bordero ? ` · Borderô ${item.bordero}` : ""}
                        </span>
                      ) : null}
                      {item.valor != null ? (
                        <span className="text-sm font-medium">{BRL.format(item.valor)}</span>
                      ) : null}
                    </div>

                    {item.titulo ? (
                      <p className="text-sm text-muted-foreground">{item.titulo}</p>
                    ) : null}

                    {item.ultimo_erro ? (
                      <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                        {item.ultimo_erro}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Tentativas: {item.tentativas}</span>
                      <span>Criado em {dataHora(item.criado_em)}</span>
                      {!bloqueado ? (
                        <span>
                          Próxima tentativa automática:{" "}
                          {item.pausada_em ? "pausada" : relativo(item.proxima_tentativa_em)}
                        </span>
                      ) : null}
                      {item.referencia_erp ? (
                        <span>Referência: {item.referencia_erp}</span>
                      ) : null}
                      {item.resolvida_manual_motivo ? (
                        <span>Motivo: {item.resolvida_manual_motivo}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={bloqueado || tentarMut.isPending}
                        onClick={() => tentarMut.mutate(item)}
                      >
                        {tentarMut.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Tentar agora
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bloqueado}
                        onClick={() =>
                          pausarMut.mutate({ item, pausar: !item.pausada_em })
                        }
                      >
                        {item.pausada_em ? (
                          <Play className="mr-2 h-4 w-4" />
                        ) : (
                          <Pause className="mr-2 h-4 w-4" />
                        )}
                        {item.pausada_em ? "Retomar" : "Pausar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={bloqueado}
                        onClick={() => {
                          setResolvendo(item);
                          setMotivo("");
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Resolver manualmente
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setVerHistorico(item)}>
                        <History className="mr-2 h-4 w-4" />
                        Histórico
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(resolvendo)} onOpenChange={(o) => !o && setResolvendo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolver manualmente</DialogTitle>
            <DialogDescription>
              Use quando o lançamento já tiver sido feito por fora. O item sai da fila e deixa de
              gerar avisos.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Como foi resolvido?"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolvendo(null)}>
              Cancelar
            </Button>
            <Button
              disabled={motivo.trim().length < 3 || resolverMut.isPending}
              onClick={() => resolverMut.mutate()}
            >
              {resolverMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(verHistorico)} onOpenChange={(o) => !o && setVerHistorico(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de tentativas</DialogTitle>
            <DialogDescription>{verHistorico?.destino}</DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {tentativas.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : (tentativas.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tentativa registrada ainda.</p>
            ) : (
              (tentativas.data ?? []).map((t) => (
                <div key={t.id} className="rounded-md border p-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      Tentativa {t.tentativa} · {t.ok ? "sucesso" : "falha"}
                    </span>
                    <span className="text-xs text-muted-foreground">{dataHora(t.criado_em)}</span>
                  </div>
                  {t.mensagem ? (
                    <p className="text-xs text-muted-foreground">{t.mensagem}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
