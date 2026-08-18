import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Pencil, Loader2, Search, Table2, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { buscarCodErpTransportadora } from "@/lib/transportadora-erp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import type { CentralDatabase } from "@/integrations/central/types";


export const Route = createFileRoute("/_authenticated/transportadoras")({
  component: TransportadorasPage,
  head: () => ({
    meta: [
      { title: "Transportadoras | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Cadastro de transportadoras com CNPJ e dados bancários para auditoria e pagamento de fretes.",
      },
      { property: "og:title", content: "Transportadoras | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Cadastro de transportadoras para auditoria e pagamento de fretes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Transportadora = CentralDatabase["public"]["Tables"]["transportadoras"]["Row"];

const schema = z.object({
  razao_social: z.string().trim().min(2).max(200),
  cnpj: z.string().trim().min(11).max(20),
  cod_erp: z.string().trim().max(40).optional().or(z.literal("")),
  banco: z.string().trim().max(80).optional().or(z.literal("")),
  agencia: z.string().trim().max(20).optional().or(z.literal("")),
  conta: z.string().trim().max(30).optional().or(z.literal("")),
  pix: z.string().trim().max(140).optional().or(z.literal("")),
  ativo: z.boolean(),
});
type FormInput = z.infer<typeof schema>;

type TabelaResumo = {
  id: string;
  nome: string;
  codigo_interno: string | null;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  transportadora_id: string;
};

function TransportadorasPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Transportadora | null>(null);
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["transportadoras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data as Transportadora[];
    },
  });

  const [tabelaAlvo, setTabelaAlvo] = useState<Transportadora | null>(null);

  const { data: tabelas } = useQuery({
    queryKey: ["tabelas-frete-vigentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("id, nome, codigo_interno, data_inicio, data_fim, ativo, transportadora_id")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as TabelaResumo[];
    },
  });

  const { data: vinculos } = useQuery({
    queryKey: ["tabelas-frete-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete_transportadoras")
        .select("tabela_id, transportadora_id");
      if (error) throw error;
      return data as { tabela_id: string; transportadora_id: string }[];
    },
  });

  const vigentePorTransportadora = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const porId = new Map((tabelas ?? []).map((t) => [t.id, t]));
    const map = new Map<string, TabelaResumo>();
    (vinculos ?? []).forEach((v) => {
      const t = porId.get(v.tabela_id);
      if (!t || !t.ativo) return;
      if (t.data_inicio > hoje) return;
      if (t.data_fim && t.data_fim < hoje) return;
      const atual = map.get(v.transportadora_id);
      if (!atual || t.data_inicio > atual.data_inicio) map.set(v.transportadora_id, t);
    });
    return map;
  }, [tabelas, vinculos]);

  const upsert = useMutation({
    mutationFn: async ({ input, tabelaId }: { input: FormInput; tabelaId: string }) => {
      const payload = {
        razao_social: input.razao_social,
        cnpj: input.cnpj.replace(/\D/g, ""),
        cod_erp: input.cod_erp || null,
        banco: input.banco || null,
        agencia: input.agencia || null,
        conta: input.conta || null,
        pix: input.pix || null,
        ativo: input.ativo,
      };
      let id = editing?.id ?? null;
      if (editing) {
        const { error } = await supabase
          .from("transportadoras")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: novo, error } = await supabase
          .from("transportadoras")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        id = (novo as { id: string }).id;
      }

      // Vínculo com a tabela de frete vigente.
      const atualId = id ? (vigentePorTransportadora.get(id)?.id ?? "") : "";
      if (id && tabelaId !== atualId) {
        const { error: delErr } = await supabase
          .from("tabelas_preco_frete_transportadoras")
          .delete()
          .eq("transportadora_id", id);
        if (delErr) throw delErr;
        if (tabelaId) {
          const { error: insErr } = await supabase
            .from("tabelas_preco_frete_transportadoras")
            .insert({ tabela_id: tabelaId, transportadora_id: id });
          if (insErr) throw insErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transportadoras"] });
      qc.invalidateQueries({ queryKey: ["tabelas-frete-vinculos"] });
      toast.success(editing ? "Transportadora atualizada" : "Transportadora criada");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: Transportadora) => {
      const { error } = await supabase
        .from("transportadoras")
        .update({ ativo: !t.ativo })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transportadoras"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const buscarCodErp = useServerFn(buscarCodErpTransportadora);
  const [buscandoId, setBuscandoId] = useState<string | null>(null);

  const consultarErp = useMutation({
    mutationFn: async (t: Transportadora) => {
      setBuscandoId(t.id);
      const { codErp } = await buscarCodErp({ data: { cnpj: t.cnpj } });
      if (!codErp) return { codErp: null as string | null };
      const { error } = await supabase
        .from("transportadoras")
        .update({ cod_erp: codErp })
        .eq("id", t.id);
      if (error) throw error;
      return { codErp };
    },
    onSuccess: (r) => {
      setBuscandoId(null);
      if (r.codErp) {
        qc.invalidateQueries({ queryKey: ["transportadoras"] });
        toast.success(`Código no ERP: ${r.codErp}`);
      } else {
        toast.warning("Nenhum código encontrado no ERP para este CNPJ");
      }
    },
    onError: (e: Error) => {
      setBuscandoId(null);
      toast.error(e.message);
    },
  });

  const columns = useMemo<ColumnDef<Transportadora>[]>(
    () => [
      {
        id: "razao_social",
        header: "Razão social",
        accessor: (t) => t.razao_social,
        className: "font-medium",
      },
      {
        id: "cnpj",
        header: "CNPJ",
        accessor: (t) => t.cnpj,
        className: "font-mono text-xs",
      },
      {
        id: "cod_erp",
        header: "Cód. ERP",
        accessor: (t) => t.cod_erp ?? "",
        render: (t) => (
          <span className="flex items-center gap-1">
            {t.cod_erp ? (
              <span className="font-mono text-xs">{t.cod_erp}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              title="Consultar código no ERP"
              disabled={buscandoId === t.id}
              onClick={() => consultarErp.mutate(t)}
            >
              {buscandoId === t.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Search className="h-3 w-3" />
              )}
            </Button>
          </span>
        ),
      },

      {
        id: "tabela_vigente",
        header: "Tabela de frete vigente",
        accessor: (t) => vigentePorTransportadora.get(t.id)?.nome ?? "",
        render: (t) => {
          const tab = vigentePorTransportadora.get(t.id);
          return (
            <span className="flex items-center gap-1">
              {tab ? (
                <Link
                  to="/tabelas-frete"
                  search={{ tabela: tab.id }}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  title="Abrir tabela de frete"
                >
                  {tab.nome}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ) : (
                <span className="text-muted-foreground">Sem tabela vigente</span>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                title="Alterar tabela vigente"
                onClick={() => setTabelaAlvo(t)}
              >
                <Table2 className="h-3 w-3" />
              </Button>
            </span>
          );
        },
      },
      {
        id: "banco",
        header: "Banco",
        accessor: (t) => t.banco ?? "",
        render: (t) =>
          t.banco ? (
            <>
              <span>{t.banco}</span>
              <span className="text-xs text-muted-foreground">
                {t.agencia ? ` · Ag ${t.agencia}` : ""}
                {t.conta ? ` · CC ${t.conta}` : ""}
              </span>
            </>
          ) : (
            "—"
          ),
      },
      { id: "pix", header: "PIX", accessor: (t) => t.pix ?? "" },
      {
        id: "ativo",
        header: "Ativo",
        align: "center",
        accessor: (t) => (t.ativo ? "sim" : "não"),
        render: (t) => <Switch checked={t.ativo} onCheckedChange={() => toggle.mutate(t)} />,
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (t) => (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => {
              setEditing(t);
              setOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [buscandoId, vigentePorTransportadora],

  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Transportadoras</h1>
            <p className="text-muted-foreground text-sm">
              Cadastro das transportadoras emissoras de CT-e e seus dados de pagamento.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova transportadora
          </Button>
        </div>

        <DataTable
          tableKey="transportadoras"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(t) => t.id}
          emptyMessage="Nenhuma transportadora cadastrada."
          defaultSort={{ id: "razao_social", dir: "asc" }}
        />
      </div>

      <TransportadoraDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        tabelas={tabelas ?? []}
        tabelaAtualId={editing ? (vigentePorTransportadora.get(editing.id)?.id ?? "") : ""}
        onSubmit={(v, tabelaId) => upsert.mutate({ input: v, tabelaId })}
        submitting={upsert.isPending}
      />

      <TabelaVigenteDialog
        key={tabelaAlvo?.id ?? "none"}
        transportadora={tabelaAlvo}
        onOpenChange={(o) => !o && setTabelaAlvo(null)}
        tabelas={tabelas ?? []}
        atual={tabelaAlvo ? (vigentePorTransportadora.get(tabelaAlvo.id) ?? null) : null}
      />
    </AppShell>
  );
}

function TabelaVigenteDialog({
  transportadora,
  onOpenChange,
  tabelas,
  atual,
}: {
  transportadora: Transportadora | null;
  onOpenChange: (o: boolean) => void;
  tabelas: TabelaResumo[];
  atual: TabelaResumo | null;
}) {
  const qc = useQueryClient();
  const [selecionada, setSelecionada] = useState<string>(atual?.id ?? "");

  const hoje = new Date().toISOString().slice(0, 10);
  const opcoes = tabelas.filter(
    (t) => t.ativo && t.data_inicio <= hoje && (!t.data_fim || t.data_fim >= hoje),
  );

  const salvar = useMutation({
    mutationFn: async () => {
      if (!transportadora) return;
      const { error: delErr } = await supabase
        .from("tabelas_preco_frete_transportadoras")
        .delete()
        .eq("transportadora_id", transportadora.id);
      if (delErr) throw delErr;
      if (selecionada) {
        const { error } = await supabase
          .from("tabelas_preco_frete_transportadoras")
          .insert({ tabela_id: selecionada, transportadora_id: transportadora.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabelas-frete-vinculos"] });
      qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
      toast.success("Tabela de frete vigente atualizada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={Boolean(transportadora)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tabela de frete vigente</DialogTitle>
          <DialogDescription>{transportadora?.razao_social}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tabela vigente</Label>
            <Select value={selecionada || "none"} onValueChange={(v) => setSelecionada(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a tabela" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tabela vigente</SelectItem>
                {opcoes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome}
                    {t.codigo_interno ? ` · ${t.codigo_interno}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!opcoes.length && (
              <p className="text-xs text-muted-foreground">
                Nenhuma tabela ativa vigente cadastrada hoje.
              </p>
            )}
          </div>

          {selecionada && (
            <Link
              to="/tabelas-frete"
              search={{ tabela: selecionada }}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              Visualizar / editar esta tabela <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TransportadoraDialog({
  open,
  onOpenChange,
  editing,
  tabelas,
  tabelaAtualId,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Transportadora | null;
  tabelas: TabelaResumo[];
  tabelaAtualId: string;
  onSubmit: (v: FormInput, tabelaId: string) => void;
  submitting: boolean;
}) {
  const buscarCodErp = useServerFn(buscarCodErpTransportadora);
  const [consultando, setConsultando] = useState(false);
  const [tabelaId, setTabelaId] = useState(tabelaAtualId);
  const hoje = new Date().toISOString().slice(0, 10);
  const opcoesTabelas = tabelas.filter(
    (t) =>
      t.id === tabelaAtualId ||
      (t.ativo && t.data_inicio <= hoje && (!t.data_fim || t.data_fim >= hoje)),
  );
  const form = useForm<FormInput>({

    resolver: zodResolver(schema),
    defaultValues: {
      razao_social: editing?.razao_social ?? "",
      cnpj: editing?.cnpj ?? "",
      banco: editing?.banco ?? "",
      agencia: editing?.agencia ?? "",
      conta: editing?.conta ?? "",
      cod_erp: editing?.cod_erp ?? "",
      pix: editing?.pix ?? "",
      ativo: editing?.ativo ?? true,
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar transportadora" : "Nova transportadora"}
          </DialogTitle>
          <DialogDescription>Identificação e dados bancários.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit((v) => onSubmit(v, tabelaId))}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Razão social *</Label>
            <Input {...form.register("razao_social")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CNPJ *</Label>
            <Input {...form.register("cnpj")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código no ERP</Label>
            <div className="flex gap-2">
              <Input {...form.register("cod_erp")} placeholder="Ex.: 1234" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Consultar no ERP pelo CNPJ"
                disabled={consultando}
                onClick={async () => {
                  const cnpj = form.getValues("cnpj");
                  if (!cnpj) return toast.error("Informe o CNPJ primeiro");
                  setConsultando(true);
                  try {
                    const { codErp } = await buscarCodErp({ data: { cnpj } });
                    if (codErp) {
                      form.setValue("cod_erp", codErp, { shouldDirty: true });
                      toast.success(`Código no ERP: ${codErp}`);
                    } else {
                      toast.warning("Nenhum código encontrado no ERP para este CNPJ");
                    }
                  } catch (e) {
                    toast.error((e as Error).message);
                  } finally {
                    setConsultando(false);
                  }
                }}
              >
                {consultando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Banco</Label>
            <Input {...form.register("banco")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Agência</Label>
            <Input {...form.register("agencia")} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <Input {...form.register("conta")} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Chave PIX</Label>
            <Input {...form.register("pix")} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Tabela de frete vigente</Label>
            <div className="flex items-center gap-2">
              <Select
                value={tabelaId || "none"}
                onValueChange={(v) => setTabelaId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione a tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem tabela vigente</SelectItem>
                  {opcoesTabelas.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                      {t.codigo_interno ? ` · ${t.codigo_interno}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tabelaId && (
                <Link
                  to="/tabelas-frete"
                  search={{ tabela: tabelaId }}
                  className="text-primary hover:underline inline-flex items-center gap-1 text-xs whitespace-nowrap"
                  title="Abrir tabela de frete"
                >
                  Abrir <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Switch
              id="ativo"
              checked={form.watch("ativo")}
              onCheckedChange={(v) => form.setValue("ativo", v)}
            />
            <Label htmlFor="ativo">Transportadora ativa</Label>
          </div>
          <DialogFooter className="md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
