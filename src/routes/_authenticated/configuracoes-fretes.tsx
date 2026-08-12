import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2,
  CircleDashed,
  ExternalLink,
  Key,
  Loader2,
  Package,
  Save,
  Settings,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  getConfiguracoesFretes,
  criarTransportadoraRapida,
  criarTabelaPrecoRapida,
  salvarToleranciasFretes,
  salvarConfiguracaoErp,
  toggleAutorizacaoPagamento,
} from "@/lib/configuracoes-fretes.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/configuracoes-fretes")({
  component: ConfiguracoesFretesPage,
  head: () => ({
    meta: [
      { title: "Configurações de fretes | SpeedFlow Logistics" },
      {
        name: "description",
        content: "Central de configuração do módulo de auditoria e pagamento de fretes.",
      },
      { property: "og:title", content: "Configurações de fretes | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Central de configuração do módulo de auditoria e pagamento de fretes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Transportadora = Tables<"transportadoras">;

type FaixaDraft = {
  peso_de: string;
  peso_ate: string;
  valor_por_kg: string;
  valor_fixo_faixa: string;
};

type TabelaForm = {
  transportadora_id: string;
  nome: string;
  tipo_calculo: "peso" | "valor";
  data_inicio: string;
  data_fim: string;
  percentual_valor: string;
  gris_percentual: string;
  ad_valorem_percentual: string;
  pedagio_valor: string;
  tas_valor: string;
  frete_minimo: string;
  icms_percentual: string;
  uf_destino: string;
  faixas: FaixaDraft[];
};

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function ConfiguracoesFretesPage() {
  const { role, loading } = useAuth();
  const qc = useQueryClient();
  const getConfig = useServerFn(getConfiguracoesFretes);
  const createTransp = useServerFn(criarTransportadoraRapida);
  const createTabela = useServerFn(criarTabelaPrecoRapida);
  const saveTolerancias = useServerFn(salvarToleranciasFretes);
  const saveErp = useServerFn(salvarConfiguracaoErp);
  const toggleAutoriza = useServerFn(toggleAutorizacaoPagamento);

  const [openTransp, setOpenTransp] = useState(false);
  const [openTabela, setOpenTabela] = useState(false);
  const [openErp, setOpenErp] = useState(false);
  const [openSecret, setOpenSecret] = useState(false);
  const [newSecret, setNewSecret] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["configuracoes-fretes"],
    queryFn: () => getConfig({}),
    enabled: role === "adm",
  });

  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras", "ativas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transportadoras").select("*").order("razao_social");
      if (error) throw error;
      return data as Transportadora[];
    },
    enabled: role === "adm",
  });

  const [toleranciaValor, setToleranciaValor] = useState("");
  const [toleranciaPercentual, setToleranciaPercentual] = useState("");

  useEffect(() => {
    if (data) {
      setToleranciaValor(String(data.toleranciaValor));
      setToleranciaPercentual(String(data.toleranciaPercentual));
    }
  }, [data]);

  const [erpUrl, setErpUrl] = useState("");
  const [erpKey, setErpKey] = useState("");

  const salvarTol = useMutation({
    mutationFn: () =>
      saveTolerancias({
        data: {
          toleranciaValor: num(toleranciaValor),
          toleranciaPercentual: num(toleranciaPercentual),
        },
      }),
    onSuccess: () => {
      toast.success("Tolerâncias salvas");
      qc.invalidateQueries({ queryKey: ["configuracoes-fretes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const salvarErp = useMutation({
    mutationFn: () => saveErp({ data: { urlBase: erpUrl, apiKey: erpKey } }),
    onSuccess: () => {
      toast.success("Configuração do ERP salva");
      setOpenErp(false);
      setErpUrl("");
      setErpKey("");
      qc.invalidateQueries({ queryKey: ["configuracoes-fretes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePerm = useMutation({
    mutationFn: ({ userId, podeAutorizar }: { userId: string; podeAutorizar: boolean }) =>
      toggleAutoriza({ data: { userId, podeAutorizar } }),
    onSuccess: () => {
      toast.success("Permissão atualizada");
      qc.invalidateQueries({ queryKey: ["configuracoes-fretes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const userColumns: ColumnDef<{ id: string; full_name: string | null; pode_autorizar: boolean }>[] =
    useMemo(
      () => [
        { id: "nome", header: "Usuário", accessor: (u) => u.full_name ?? "—", className: "font-medium" },
        {
          id: "autorizar",
          header: "Autoriza pagamento",
          align: "center",
          accessor: (u) => (u.pode_autorizar ? "sim" : "não"),
          render: (u) => (
            <Switch
              checked={u.pode_autorizar}
              disabled={togglePerm.isPending}
              onCheckedChange={(v) => togglePerm.mutate({ userId: u.id, podeAutorizar: v })}
            />
          ),
        },
      ],
      [togglePerm.isPending],
    );

  if (loading) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </AppShell>
    );
  }

  if (role !== "adm") {
    return (
      <AppShell>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Configurações de fretes</h1>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta tela.</p>
        </div>
      </AppShell>
    );
  }

  const ok = (value: boolean) =>
    value ? (
      <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
        <CheckCircle2 className="mr-1 h-3 w-3" /> OK
      </Badge>
    ) : (
      <Badge variant="outline" className="text-muted-foreground">
        <CircleDashed className="mr-1 h-3 w-3" /> Pendente
      </Badge>
    );


  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Settings className="h-6 w-6" /> Configurações de fretes
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure transportadoras, tabelas de preço, tolerâncias e permissões para o módulo de
              auditoria de CT-e.
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to="/captura-cte">
              <ShieldCheck className="mr-2 h-4 w-4" /> Captura de CT-e (certificado A1)
            </Link>
          </Button>
        </div>


        {isLoading ? (
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        ) : (
          <>
            {/* Status geral */}
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Transportadoras</span>
                    </div>
                    {ok((data?.transportadorasCount ?? 0) > 0)}
                  </div>
                  <div className="mt-2 text-2xl font-bold">{data?.transportadorasCount ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tabelas de preço ativas</span>
                    </div>
                    {ok((data?.tabelasAtivasCount ?? 0) > 0)}
                  </div>
                  <div className="mt-2 text-2xl font-bold">{data?.tabelasAtivasCount ?? 0}</div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tolerâncias</span>
                    </div>
                    {ok(data != null)}
                  </div>
                  <div className="mt-2 text-sm">
                    R$ {data?.toleranciaValor.toFixed(2) ?? "0,00"} · {data?.toleranciaPercentual.toFixed(2) ?? "0"}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Integração ERP</span>
                    </div>
                    {ok(data?.erpConfigurado ?? false)}
                  </div>
                  <div className="mt-2 text-sm text-muted-foreground">
                    {data?.erpConfigurado ? "Integração ativa" : "Modo simulado"}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Transportadoras */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Transportadoras</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/transportadoras">Gerenciar</Link>
                  </Button>
                  <Button size="sm" onClick={() => setOpenTransp(true)}>
                    Nova transportadora
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Cadastre as transportadoras emissoras de CT-e. O sistema vincula o CNPJ do emitente
                automaticamente ao importar o XML.
              </p>
            </section>

            {/* Tabelas de preço */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Tabelas de preço</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/tabelas-frete">Gerenciar</Link>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setOpenTabela(true)}
                    disabled={!transportadoras?.length}
                  >
                    Nova tabela
                  </Button>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Cadastre as regras contratadas (vigência, taxas, faixas de peso) para que o motor de
                auditoria calcule o valor esperado de cada CT-e.
              </p>
              {!transportadoras?.length ? (
                <p className="text-sm text-destructive">
                  Cadastre ao menos uma transportadora antes de criar tabelas de preço.
                </p>
              ) : null}
            </section>

            {/* Tolerâncias */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tolerâncias de auditoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  O CT-e será considerado conforme quando a diferença estiver dentro de qualquer uma
                  das tolerâncias abaixo.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="tol-valor">Tolerância em R$</Label>
                    <Input
                      id="tol-valor"
                      inputMode="decimal"
                      value={toleranciaValor}
                      onChange={(e) => setToleranciaValor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="tol-perc">Tolerância em %</Label>
                    <Input
                      id="tol-perc"
                      inputMode="decimal"
                      value={toleranciaPercentual}
                      onChange={(e) => setToleranciaPercentual(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => salvarTol.mutate()} disabled={salvarTol.isPending}>
                    {salvarTol.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Salvar tolerâncias
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Integração ERP */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Integração ERP de pagamento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Configure o endpoint que receberá as ordens de pagamento de frete. Se não
                  configurado, o sistema opera em modo simulado.
                </p>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <span className="font-medium">Modo atual:</span>{" "}
                    {data?.erpConfigurado ? "Integração ativa" : "Simulado (sem endpoint)"}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setOpenErp(true)}>
                    Configurar ERP
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Permissões */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Permissões de autorização de pagamento</h2>
              <p className="text-sm text-muted-foreground">
                Administradores já podem autorizar pagamentos. Use a lista abaixo para conceder essa
                permissão a usuários com outros papéis.
              </p>
              <DataTable
                tableKey="config-autorizacao-pagamento"
                columns={userColumns}
                data={data?.usuarios ?? []}
                rowKey={(u) => u.id}
                emptyMessage="Nenhum usuário encontrado."
              />
            </section>
          </>
        )}
      </div>

      {/* Modal nova transportadora */}
      <NovaTransportadoraDialog
        open={openTransp}
        onOpenChange={setOpenTransp}
        onSubmit={async (v) => {
          await createTransp({ data: v });
          toast.success("Transportadora criada");
          setOpenTransp(false);
          qc.invalidateQueries({ queryKey: ["configuracoes-fretes"] });
          qc.invalidateQueries({ queryKey: ["transportadoras"] });
        }}
      />

      {/* Modal nova tabela */}
      <NovaTabelaDialog
        open={openTabela}
        onOpenChange={setOpenTabela}
        transportadoras={transportadoras ?? []}
        onSubmit={async (v) => {
          await createTabela({ data: v });
          toast.success("Tabela de preço criada");
          setOpenTabela(false);
          qc.invalidateQueries({ queryKey: ["configuracoes-fretes"] });
          qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
        }}
      />

      {/* Modal ERP */}
      <Dialog open={openErp} onOpenChange={setOpenErp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar integração ERP</DialogTitle>
            <DialogDescription>
              Informe a URL base e a chave de API do endpoint de ordens de pagamento.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="erp-url">URL base do ERP</Label>
              <Input
                id="erp-url"
                value={erpUrl}
                onChange={(e) => setErpUrl(e.target.value)}
                placeholder="https://erp.exemplo.com/api"
              />
            </div>
            <div>
              <Label htmlFor="erp-key">API key</Label>
              <Input
                id="erp-key"
                type="password"
                value={erpKey}
                onChange={(e) => setErpKey(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenErp(false)}>
              Cancelar
            </Button>
            <Button onClick={() => salvarErp.mutate()} disabled={salvarErp.isPending}>
              {salvarErp.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function NovaTransportadoraDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: { razao_social: string; cnpj: string }) => Promise<void>;
}) {
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova transportadora</DialogTitle>
          <DialogDescription>Informe a razão social e o CNPJ para cadastro rápido.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="transp-razao">Razão social</Label>
            <Input id="transp-razao" value={razao} onChange={(e) => setRazao(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="transp-cnpj">CNPJ</Label>
            <Input id="transp-cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !razao.trim() || !cnpj.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit({ razao_social: razao, cnpj });
                setRazao("");
                setCnpj("");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NovaTabelaDialog({
  open,
  onOpenChange,
  transportadoras,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transportadoras: Transportadora[];
  onSubmit: (v: TabelaForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TabelaForm>(() => ({
    transportadora_id: transportadoras[0]?.id ?? "",
    nome: "",
    tipo_calculo: "peso",
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: "",
    percentual_valor: "0",
    gris_percentual: "0",
    ad_valorem_percentual: "0",
    pedagio_valor: "0",
    tas_valor: "0",
    frete_minimo: "0",
    icms_percentual: "0",
    uf_destino: "",
    faixas: [],
  }));

  const set = <K extends keyof TabelaForm>(key: K, value: TabelaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const [saving, setSaving] = useState(false);

  const addFaixa = () =>
    setForm((f) => ({
      ...f,
      faixas: [...f.faixas, { peso_de: "", peso_ate: "", valor_por_kg: "", valor_fixo_faixa: "" }],
    }));

  const updateFaixa = (idx: number, key: keyof FaixaDraft, value: string) => {
    setForm((f) => {
      const faixas = [...f.faixas];
      faixas[idx] = { ...faixas[idx], [key]: value };
      return { ...f, faixas };
    });
  };

  const removeFaixa = (idx: number) =>
    setForm((f) => ({ ...f, faixas: f.faixas.filter((_, i) => i !== idx) }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova tabela de preço</DialogTitle>
          <DialogDescription>Cadastro rápido das regras contratadas com a transportadora.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Transportadora *</Label>
            <Select value={form.transportadora_id} onValueChange={(v) => set("transportadora_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {transportadoras.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.razao_social}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo de cálculo</Label>
            <Select
              value={form.tipo_calculo}
              onValueChange={(v) => set("tipo_calculo", v as "peso" | "valor")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peso">Por peso</SelectItem>
                <SelectItem value="valor">Por valor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">UF destino</Label>
            <Input
              maxLength={2}
              value={form.uf_destino}
              onChange={(e) => set("uf_destino", e.target.value.toUpperCase())}
              placeholder="Todas"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Início da vigência *</Label>
            <Input type="date" value={form.data_inicio} onChange={(e) => set("data_inicio", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim da vigência</Label>
            <Input type="date" value={form.data_fim} onChange={(e) => set("data_fim", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">% sobre valor</Label>
            <Input inputMode="decimal" value={form.percentual_valor} onChange={(e) => set("percentual_valor", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">GRIS %</Label>
            <Input inputMode="decimal" value={form.gris_percentual} onChange={(e) => set("gris_percentual", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Ad Valorem %</Label>
            <Input inputMode="decimal" value={form.ad_valorem_percentual} onChange={(e) => set("ad_valorem_percentual", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Pedágio (R$)</Label>
            <Input inputMode="decimal" value={form.pedagio_valor} onChange={(e) => set("pedagio_valor", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">TAS (R$)</Label>
            <Input inputMode="decimal" value={form.tas_valor} onChange={(e) => set("tas_valor", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frete mínimo (R$)</Label>
            <Input inputMode="decimal" value={form.frete_minimo} onChange={(e) => set("frete_minimo", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">ICMS %</Label>
            <Input inputMode="decimal" value={form.icms_percentual} onChange={(e) => set("icms_percentual", e.target.value)} />
          </div>
        </div>

        {form.tipo_calculo === "peso" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Faixas de peso</Label>
              <Button type="button" variant="outline" size="sm" onClick={addFaixa}>
                Adicionar faixa
              </Button>
            </div>
            {form.faixas.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Adicione ao menos uma faixa para cálculo por peso.
              </p>
            )}
            {form.faixas.map((f, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-5 items-end">
                <div>
                  <Label className="text-xs">Peso de (kg)</Label>
                  <Input inputMode="decimal" value={f.peso_de} onChange={(e) => updateFaixa(i, "peso_de", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Peso até (kg)</Label>
                  <Input inputMode="decimal" value={f.peso_ate} onChange={(e) => updateFaixa(i, "peso_ate", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">R$/kg</Label>
                  <Input inputMode="decimal" value={f.valor_por_kg} onChange={(e) => updateFaixa(i, "valor_por_kg", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Valor fixo (R$)</Label>
                  <Input inputMode="decimal" value={f.valor_fixo_faixa} onChange={(e) => updateFaixa(i, "valor_fixo_faixa", e.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFaixa(i)}>
                  Remover
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !form.transportadora_id || !form.nome.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await onSubmit(form);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar tabela
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
