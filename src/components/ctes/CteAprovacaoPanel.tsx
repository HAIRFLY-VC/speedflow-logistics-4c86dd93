import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aprovarCte, previewAprovacaoCte, reprovarCte } from "@/lib/frete-aprovacao.functions";
import { CAMPOS_ERP } from "@/lib/frete-aprovacao.types";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CteAprovacaoPanel({ cteId }: { cteId: string }) {
  const qc = useQueryClient();
  const preview = useServerFn(previewAprovacaoCte);
  const aprovar = useServerFn(aprovarCte);
  const reprovar = useServerFn(reprovarCte);

  const [selecoes, setSelecoes] = useState<Record<string, string>>({});
  const [reprovaAberta, setReprovaAberta] = useState(false);
  const [observacao, setObservacao] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["cte-aprovacao", cteId],
    queryFn: async () => await preview({ data: { cteId } }),
    staleTime: 60_000,
  });

  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: ["cte-aprovacao", cteId] });
    void qc.invalidateQueries({ queryKey: ["ctes"] });
    void qc.invalidateQueries({ queryKey: ["cte"] });
  };

  const mAprovar = useMutation({
    mutationFn: async () =>
      await aprovar({
        data: {
          cteId,
          selecoes: Object.entries(selecoes).map(([chave, bordero]) => ({
            chave,
            bordero: bordero || null,
          })),
        },
      }),
    onSuccess: (r) => {
      toast.success(`CT-e aprovado. ${r.linhas} lançamento(s) enviados para a fila do ERP.`);
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mReprovar = useMutation({
    mutationFn: async () => await reprovar({ data: { cteId, observacao } }),
    onSuccess: () => {
      toast.success("CT-e reprovado.");
      setReprovaAberta(false);
      setObservacao("");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <section className="rounded-md border p-3">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando aprovação…
        </div>
      </section>
    );
  }
  if (!data) return null;

  const decidido = data.aprovacaoStatus !== "PENDENTE";

  return (
    <section className="space-y-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Aprovação e lançamento no ERP
        </div>
        <Badge
          variant="outline"
          className={
            data.aprovacaoStatus === "APROVADO"
              ? "border-emerald-500/40 text-emerald-600"
              : data.aprovacaoStatus === "REPROVADO"
                ? "border-destructive/40 text-destructive"
                : "text-muted-foreground"
          }
        >
          {data.aprovacaoStatus === "APROVADO"
            ? "Aprovado"
            : data.aprovacaoStatus === "REPROVADO"
              ? "Reprovado"
              : "Pendente"}
        </Badge>
      </div>

      {data.observacao ? (
        <div className="text-muted-foreground text-xs">Observação: {data.observacao}</div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CAMPOS_ERP.map(({ campo, label }) => (
          <div key={campo} className="rounded-md border px-2 py-1.5">
            <div className="text-muted-foreground text-[10px] uppercase">{label}</div>
            <div className="text-sm font-medium tabular-nums">{brl(data.valores[campo])}</div>
          </div>
        ))}
      </div>

      <div className="rounded-md border">
        <div className="bg-muted/40 grid grid-cols-[1.6fr_1fr_1fr] gap-2 px-3 py-1.5 text-[11px] font-medium">
          <span>Componente do CT-e</span>
          <span className="text-right">Valor</span>
          <span className="text-right">Campo no ERP</span>
        </div>
        {data.componentes.map((c, i) => (
          <div
            key={`${c.nome}-${i}`}
            className="grid grid-cols-[1.6fr_1fr_1fr] items-center gap-2 border-t px-3 py-1.5 text-xs"
          >
            <span>{c.nome}</span>
            <span className="text-right tabular-nums">{brl(c.valor)}</span>
            <span className="text-right">
              {c.campo ? (
                <span>
                  {CAMPOS_ERP.find((x) => x.campo === c.campo)?.label}
                  {c.origem === "automatico" ? (
                    <span className="text-muted-foreground text-[10px]"> (padrão)</span>
                  ) : null}
                </span>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-600">
                  sem de-para
                </Badge>
              )}
            </span>
          </div>
        ))}
      </div>

      {data.naoMapeados.length > 0 ? (
        <div className="text-xs text-amber-600">
          Configure o de-para destes componentes em “Config. de fretes” antes de aprovar:{" "}
          {data.naoMapeados.join(", ")}
        </div>
      ) : null}

      <div className="rounded-md border">
        <div className="bg-muted/40 grid grid-cols-[1fr_1fr_1.6fr] gap-2 px-3 py-1.5 text-[11px] font-medium">
          <span>NF-e</span>
          <span className="text-right">Valor rateado</span>
          <span>Registro no ERP</span>
        </div>
        {data.notas.map((n) => {
          const total = CAMPOS_ERP.reduce((s, c) => s + n.valores[c.campo], 0);
          return (
            <div
              key={n.chave}
              className="grid grid-cols-[1fr_1fr_1.6fr] items-center gap-2 border-t px-3 py-1.5 text-xs"
            >
              <span className="font-medium">{n.numero || n.chave.slice(25, 34)}</span>
              <span className="text-right tabular-nums">{brl(total)}</span>
              <span>
                {n.registros.length === 0 ? (
                  <span className="text-muted-foreground">Nenhum registro encontrado</span>
                ) : n.registros.length === 1 ? (
                  <span className="text-muted-foreground">
                    Borderô {n.registros[0]!.bordero ?? "—"}
                  </span>
                ) : (
                  <Select
                    value={selecoes[n.chave] ?? ""}
                    onValueChange={(v) => setSelecoes((s) => ({ ...s, [n.chave]: v }))}
                    disabled={decidido}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue placeholder="Selecione o registro" />
                    </SelectTrigger>
                    <SelectContent>
                      {n.registros.map((r, i) => (
                        <SelectItem key={`${r.bordero}-${i}`} value={r.bordero ?? `#${i}`}>
                          Borderô {r.bordero ?? "—"}
                          {r.dt_saida ? ` · ${r.dt_saida}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {!data.cod_filial ? (
        <div className="text-destructive text-xs">
          A empresa deste CT-e está sem “Código da empresa no ERP”. Cadastre em Empresas.
        </div>
      ) : null}

      <p className="text-muted-foreground text-xs">
        A aprovação lança automaticamente apenas os <strong>valores de frete</strong> no ERP. O
        provisionamento financeiro (contas a pagar) ainda não é automático e precisa ser feito
        manualmente.
      </p>


      {decidido ? (
        <div className="text-muted-foreground flex items-center gap-2 text-xs">
          <CheckCircle2 className="h-4 w-4" /> Decisão já registrada para este CT-e.
        </div>
      ) : (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setReprovaAberta(true)}
            disabled={mAprovar.isPending}
          >
            <ThumbsDown className="mr-1 h-4 w-4" /> Reprovar
          </Button>
          <Button
            onClick={() => mAprovar.mutate()}
            disabled={mAprovar.isPending || data.naoMapeados.length > 0 || !data.cod_filial}
          >
            {mAprovar.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ThumbsUp className="mr-1 h-4 w-4" />
            )}
            Aprovar e lançar no ERP
          </Button>
        </div>
      )}

      <Dialog open={reprovaAberta} onOpenChange={setReprovaAberta}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reprovar CT-e</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Descreva o motivo da reprovação"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReprovaAberta(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => mReprovar.mutate()}
              disabled={observacao.trim().length < 3 || mReprovar.isPending}
            >
              {mReprovar.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              Confirmar reprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
