import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, KeyRound, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  excluirMapeamentoComponente,
  gerarTokenN8n,
  getConfigLancamentoErp,
  salvarIntegracaoN8n,
  salvarMapeamentoComponente,
} from "@/lib/frete-aprovacao.functions";
import { CAMPOS_ERP, type ErpCampoValor } from "@/lib/frete-aprovacao.types";

const GERAL = "__geral__";

export function LancamentoErpConfig() {
  const qc = useQueryClient();
  const carregar = useServerFn(getConfigLancamentoErp);
  const salvarMap = useServerFn(salvarMapeamentoComponente);
  const excluirMap = useServerFn(excluirMapeamentoComponente);
  const salvarN8n = useServerFn(salvarIntegracaoN8n);
  const gerarToken = useServerFn(gerarTokenN8n);

  const { data, isLoading } = useQuery({
    queryKey: ["config-lancamento-erp"],
    queryFn: async () => await carregar({}),
  });

  const [novo, setNovo] = useState<{ transp: string; nome: string; campo: ErpCampoValor }>({
    transp: GERAL,
    nome: "",
    campo: "vlr_frete",
  });
  const [n8n, setN8n] = useState({ url: "", urlFin: "", ativo: false });
  const [token, setToken] = useState("");
  const callbackUrl =
    typeof window === "undefined"
      ? "/api/public/hooks/erp-fila-callback"
      : `${window.location.origin}/api/public/hooks/erp-fila-callback`;

  useEffect(() => {
    if (data?.n8n) {
      setN8n({
        url: data.n8n.webhook_url ?? "",
        urlFin: data.n8n.webhook_url_financeiro ?? "",
        ativo: data.n8n.ativo,
      });
      setToken(data.n8n.webhook_token ?? "");
    }
  }, [data?.n8n]);

  const invalidar = () => void qc.invalidateQueries({ queryKey: ["config-lancamento-erp"] });

  const mSalvar = useMutation({
    mutationFn: async () =>
      await salvarMap({
        data: {
          transportadoraId: novo.transp === GERAL ? null : novo.transp,
          nomeComponente: novo.nome,
          campoErp: novo.campo,
        },
      }),
    onSuccess: () => {
      toast.success("De-para salvo");
      setNovo((n) => ({ ...n, nome: "" }));
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mExcluir = useMutation({
    mutationFn: async (id: string) => await excluirMap({ data: { id } }),
    onSuccess: () => invalidar(),
    onError: (e: Error) => toast.error(e.message),
  });

  const mToken = useMutation({
    mutationFn: async () => await gerarToken({}),
    onSuccess: (r: { token: string }) => {
      setToken(r.token);
      toast.success("Novo token gerado");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copiar = (valor: string, label: string) => {
    void navigator.clipboard.writeText(valor).then(() => toast.success(`${label} copiado`));
  };

  const mN8n = useMutation({
    mutationFn: async () =>
      await salvarN8n({
        data: { webhookUrl: n8n.url, webhookUrlFinanceiro: n8n.urlFin, ativo: n8n.ativo },
      }),
    onSuccess: () => {
      toast.success("Integração n8n salva");
      invalidar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nomeTransp = (id: string | null) =>
    id ? (data?.transportadoras.find((t) => t.id === id)?.razao_social ?? id) : "Todas (padrão)";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Lançamento no ERP (aprovação de CT-e)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-muted-foreground text-sm">
          Defina em qual campo do ERP cada componente do CT-e deve ser contabilizado e o webhook
          do n8n que consome as filas de lançamento.
        </p>

        <div className="space-y-2">
          <Label className="text-xs">De-para de componentes</Label>
          <div className="grid items-end gap-2 sm:grid-cols-[1.2fr_1.2fr_1fr_auto]">
            <div>
              <Label className="text-xs">Transportadora</Label>
              <Select
                value={novo.transp}
                onValueChange={(v) => setNovo((n) => ({ ...n, transp: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={GERAL}>Todas (padrão)</SelectItem>
                  {(data?.transportadoras ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Componente do CT-e</Label>
              <Input
                placeholder="Ex.: FRETE PESO"
                value={novo.nome}
                onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Campo no ERP</Label>
              <Select
                value={novo.campo}
                onValueChange={(v) => setNovo((n) => ({ ...n, campo: v as ErpCampoValor }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS_ERP.map((c) => (
                    <SelectItem key={c.campo} value={c.campo}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => mSalvar.mutate()}
              disabled={!novo.nome.trim() || mSalvar.isPending}
            >
              {mSalvar.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>

          <div className="rounded-md border">
            <div className="bg-muted/40 grid grid-cols-[1.2fr_1.4fr_1fr_auto] gap-2 px-3 py-1.5 text-[11px] font-medium">
              <span>Transportadora</span>
              <span>Componente</span>
              <span>Campo no ERP</span>
              <span />
            </div>
            {isLoading ? (
              <div className="text-muted-foreground px-3 py-3 text-xs">Carregando…</div>
            ) : (data?.mapeamentos ?? []).length === 0 ? (
              <div className="text-muted-foreground px-3 py-3 text-xs">
                Nenhum de-para cadastrado — o sistema usa as regras padrão por nome.
              </div>
            ) : (
              (data?.mapeamentos ?? []).map((m) => (
                <div
                  key={m.id}
                  className="grid grid-cols-[1.2fr_1.4fr_1fr_auto] items-center gap-2 border-t px-3 py-1.5 text-xs"
                >
                  <span>{nomeTransp(m.transportadora_id)}</span>
                  <span>{m.nome_componente_cte}</span>
                  <span>{CAMPOS_ERP.find((c) => c.campo === m.campo_erp)?.label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mExcluir.mutate(m.id)}
                    disabled={mExcluir.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-3 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Webhook n8n</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-xs">Ativo</span>
              <Switch
                checked={n8n.ativo}
                onCheckedChange={(v) => setN8n((s) => ({ ...s, ativo: v }))}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                n8n.ativo && n8n.url
                  ? "border-emerald-500/40 text-emerald-600"
                  : "border-amber-500/40 text-amber-600"
              }
            >
              Valores: {n8n.ativo && n8n.url ? "ativo" : "não configurado"}
            </Badge>
            <Badge
              variant="outline"
              className={
                n8n.ativo && n8n.urlFin
                  ? "border-emerald-500/40 text-emerald-600"
                  : "border-amber-500/40 text-amber-600"
              }
            >
              Financeiro: {n8n.ativo && n8n.urlFin ? "ativo" : "não configurado"}
            </Badge>
          </div>
          {!(n8n.ativo && n8n.urlFin) ? (
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              Somente o fluxo de lançamento de valores está ativo. O provisionamento financeiro
              ainda precisa ser feito manualmente — a aprovação de um CT-e não gera lançamento
              automático no contas a pagar.
            </p>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-xs">URL — lançamento de valores</Label>
              <Input
                placeholder="https://n8n.exemplo.com/webhook/frete-valores"
                value={n8n.url}
                onChange={(e) => setN8n((s) => ({ ...s, url: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">URL — provisionamento financeiro</Label>
              <Input
                placeholder="https://n8n.exemplo.com/webhook/frete-financeiro"
                value={n8n.urlFin}
                onChange={(e) => setN8n((s) => ({ ...s, urlFin: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Token do webhook</Label>
            <div className="flex gap-2">
              <Input readOnly value={token} placeholder="Nenhum token gerado" className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copiar(token, "Token")} disabled={!token}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => mToken.mutate()} disabled={mToken.isPending}>
                {mToken.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="mr-2 h-4 w-4" />
                )}
                Gerar
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              Enviado ao n8n no header <code className="bg-muted rounded px-1">X-Webhook-Token</code> e
              exigido de volta no callback.
            </p>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">URL de callback (informar no n8n)</Label>
            <div className="flex gap-2">
              <Input readOnly value={callbackUrl} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => copiar(callbackUrl, "URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => mN8n.mutate()} disabled={mN8n.isPending}>
              {mN8n.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Salvar integração
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
