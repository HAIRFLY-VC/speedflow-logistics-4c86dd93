import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/tabelas-frete")({
  component: TabelasFretePage,
  head: () => ({
    meta: [
      { title: "Tabelas de preço de frete | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Cadastro das tabelas de preço de frete por transportadora, com vigência, faixas de peso e taxas.",
      },
      {
        property: "og:title",
        content: "Tabelas de preço de frete | SpeedFlow Logistics",
      },
      {
        property: "og:description",
        content: "Vigência, faixas de peso e taxas usadas na auditoria de CT-e.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Tabela = Tables<"tabelas_preco_frete">;
type Faixa = Tables<"tabelas_preco_frete_faixas">;
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
  descricao: string;
  data_inicio: string;
  data_fim: string;
  tipo_calculo: "peso" | "valor";
  percentual_valor: string;
  gris_percentual: string;
  ad_valorem_percentual: string;
  pedagio_valor: string;
  tas_valor: string;
  frete_minimo: string;
  icms_percentual: string;
  uf_destino: string;
  ativo: boolean;
};

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function emptyForm(): TabelaForm {
  return {
    transportadora_id: "",
    nome: "",
    descricao: "",
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: "",
    tipo_calculo: "peso",
    percentual_valor: "0",
    gris_percentual: "0",
    ad_valorem_percentual: "0",
    pedagio_valor: "0",
    tas_valor: "0",
    frete_minimo: "0",
    icms_percentual: "0",
    uf_destino: "",
    ativo: true,
  };
}

function TabelasFretePage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Tabela | null>(null);

  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras", "ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("*")
        .order("razao_social");
      if (error) throw error;
      return data as Transportadora[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["tabelas-frete"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data as Tabela[];
    },
  });

  const nomeTransportadora = useMemo(() => {
    const map = new Map<string, string>();
    (transportadoras ?? []).forEach((t) => map.set(t.id, t.razao_social));
    return map;
  }, [transportadoras]);

  const toggle = useMutation({
    mutationFn: async (t: Tabela) => {
      const { error } = await supabase
        .from("tabelas_preco_frete")
        .update({ ativo: !t.ativo })
        .eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tabelas-frete"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const columns = useMemo<ColumnDef<Tabela>[]>(
    () => [
      {
        id: "transportadora",
        header: "Transportadora",
        accessor: (t) => nomeTransportadora.get(t.transportadora_id) ?? "—",
        className: "font-medium",
      },
      { id: "nome", header: "Tabela", accessor: (t) => t.nome },
      {
        id: "vigencia",
        header: "Vigência",
        accessor: (t) => t.data_inicio,
        render: (t) => (
          <span className="text-xs">
            {t.data_inicio.split("-").reverse().join("/")} →{" "}
            {t.data_fim ? t.data_fim.split("-").reverse().join("/") : "indeterminado"}
          </span>
        ),
      },
      {
        id: "tipo",
        header: "Cálculo",
        accessor: (t) => t.tipo_calculo,
        render: (t) => (t.tipo_calculo === "peso" ? "Por peso" : "Por valor"),
      },
      {
        id: "uf",
        header: "UF",
        align: "center",
        accessor: (t) => t.uf_destino ?? "",
        render: (t) => t.uf_destino ?? "—",
      },
      {
        id: "minimo",
        header: "Frete mínimo",
        align: "right",
        accessor: (t) => Number(t.frete_minimo),
        render: (t) => brl(Number(t.frete_minimo)),
      },
      {
        id: "ativo",
        header: "Ativa",
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
    [nomeTransportadora],
  );

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Tabelas de preço de frete</h1>
            <p className="text-muted-foreground text-sm">
              Regras contratadas por transportadora usadas para auditar os CT-e.
            </p>
          </div>
          <Button
            disabled={!transportadoras?.length}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Nova tabela
          </Button>
        </div>

        {!transportadoras?.length ? (
          <p className="text-sm text-muted-foreground">
            Cadastre uma transportadora antes de criar tabelas de preço.
          </p>
        ) : null}

        <DataTable
          tableKey="tabelas-frete"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(t) => t.id}
          emptyMessage="Nenhuma tabela cadastrada."
          defaultSort={{ id: "transportadora", dir: "asc" }}
        />
      </div>

      {open ? (
        <TabelaDialog
          key={editing?.id ?? "new"}
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
          editing={editing}
          transportadoras={transportadoras ?? []}
        />
      ) : null}
    </AppShell>
  );
}

function TabelaDialog({
  open,
  onOpenChange,
  editing,
  transportadoras,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Tabela | null;
  transportadoras: Transportadora[];
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<TabelaForm>(() =>
    editing
      ? {
          transportadora_id: editing.transportadora_id,
          nome: editing.nome,
          descricao: editing.descricao ?? "",
          data_inicio: editing.data_inicio,
          data_fim: editing.data_fim ?? "",
          tipo_calculo: editing.tipo_calculo,
          percentual_valor: String(editing.percentual_valor),
          gris_percentual: String(editing.gris_percentual),
          ad_valorem_percentual: String(editing.ad_valorem_percentual),
          pedagio_valor: String(editing.pedagio_valor),
          tas_valor: String(editing.tas_valor),
          frete_minimo: String(editing.frete_minimo),
          icms_percentual: String(editing.icms_percentual),
          uf_destino: editing.uf_destino ?? "",
          ativo: editing.ativo,
        }
      : { ...emptyForm(), transportadora_id: transportadoras[0]?.id ?? "" },
  );
  const [faixas, setFaixas] = useState<FaixaDraft[]>([]);

  useQuery({
    queryKey: ["tabela-faixas", editing?.id],
    enabled: Boolean(editing?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete_faixas")
        .select("*")
        .eq("tabela_id", editing!.id)
        .order("peso_de");
      if (error) throw error;
      setFaixas(
        (data as Faixa[]).map((f) => ({
          peso_de: String(f.peso_de),
          peso_ate: f.peso_ate == null ? "" : String(f.peso_ate),
          valor_por_kg: String(f.valor_por_kg),
          valor_fixo_faixa: String(f.valor_fixo_faixa),
        })),
      );
      return data as Faixa[];
    },
  });

  const set = <K extends keyof TabelaForm>(key: K, value: TabelaForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: async () => {
      if (!form.transportadora_id) throw new Error("Selecione a transportadora");
      if (form.nome.trim().length < 2) throw new Error("Informe o nome da tabela");
      if (form.data_fim && form.data_fim < form.data_inicio)
        throw new Error("Data fim não pode ser anterior à data início");

      const payload = {
        transportadora_id: form.transportadora_id,
        nome: form.nome.trim(),
        descricao: form.descricao.trim() || null,
        data_inicio: form.data_inicio,
        data_fim: form.data_fim || null,
        tipo_calculo: form.tipo_calculo,
        percentual_valor: num(form.percentual_valor),
        gris_percentual: num(form.gris_percentual),
        ad_valorem_percentual: num(form.ad_valorem_percentual),
        pedagio_valor: num(form.pedagio_valor),
        tas_valor: num(form.tas_valor),
        frete_minimo: num(form.frete_minimo),
        icms_percentual: num(form.icms_percentual),
        uf_destino: form.uf_destino.trim().toUpperCase() || null,
        ativo: form.ativo,
      };

      let tabelaId = editing?.id;
      if (editing) {
        const { error } = await supabase
          .from("tabelas_preco_frete")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("tabelas_preco_frete")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        tabelaId = data.id;
      }

      if (!tabelaId) throw new Error("Falha ao salvar a tabela");

      const { error: delError } = await supabase
        .from("tabelas_preco_frete_faixas")
        .delete()
        .eq("tabela_id", tabelaId);
      if (delError) throw delError;

      const rows = faixas
        .filter((f) => f.peso_de !== "" || f.peso_ate !== "")
        .map((f) => ({
          tabela_id: tabelaId!,
          peso_de: num(f.peso_de),
          peso_ate: f.peso_ate === "" ? null : num(f.peso_ate),
          valor_por_kg: num(f.valor_por_kg),
          valor_fixo_faixa: num(f.valor_fixo_faixa),
        }));
      if (rows.length) {
        const { error } = await supabase.from("tabelas_preco_frete_faixas").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
      qc.invalidateQueries({ queryKey: ["tabela-faixas"] });
      toast.success(editing ? "Tabela atualizada" : "Tabela criada");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar tabela" : "Nova tabela de preço"}</DialogTitle>
          <DialogDescription>
            Vigência, taxas e faixas de peso contratadas com a transportadora.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs">Transportadora *</Label>
            <Select
              value={form.transportadora_id}
              onValueChange={(v) => set("transportadora_id", v)}
            >
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

          <div className="md:col-span-2 space-y-1.5">
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
            <Input
              type="date"
              value={form.data_inicio}
              onChange={(e) => set("data_inicio", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Fim da vigência</Label>
            <Input
              type="date"
              value={form.data_fim}
              onChange={(e) => set("data_fim", e.target.value)}
            />
          </div>
          <div className="flex items-end gap-3">
            <Switch
              id="tabela-ativa"
              checked={form.ativo}
              onCheckedChange={(v) => set("ativo", v)}
            />
            <Label htmlFor="tabela-ativa" className="pb-2">
              Tabela ativa
            </Label>
          </div>

          {(
            [
              ["percentual_valor", "% sobre valor"],
              ["gris_percentual", "GRIS %"],
              ["ad_valorem_percentual", "Ad valorem %"],
              ["pedagio_valor", "Pedágio (R$)"],
              ["tas_valor", "TAS (R$)"],
              ["frete_minimo", "Frete mínimo (R$)"],
              ["icms_percentual", "ICMS %"],
            ] as [keyof TabelaForm, string][]
          ).map(([key, label]) => (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label}</Label>
              <Input
                inputMode="decimal"
                value={String(form[key])}
                onChange={(e) => set(key, e.target.value as never)}
              />
            </div>
          ))}

          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Faixas de peso</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setFaixas((f) => [
                  ...f,
                  { peso_de: "0", peso_ate: "", valor_por_kg: "0", valor_fixo_faixa: "0" },
                ])
              }
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar faixa
            </Button>
          </div>

          {faixas.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma faixa cadastrada. Use faixas quando o cálculo for por peso.
            </p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-xs text-muted-foreground">
                <span>Peso de (kg)</span>
                <span>Peso até (kg)</span>
                <span>Valor por kg</span>
                <span>Valor fixo</span>
                <span />
              </div>
              {faixas.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center"
                >
                  {(
                    ["peso_de", "peso_ate", "valor_por_kg", "valor_fixo_faixa"] as (keyof FaixaDraft)[]
                  ).map((key) => (
                    <Input
                      key={key}
                      inputMode="decimal"
                      placeholder={key === "peso_ate" ? "sem limite" : ""}
                      value={f[key]}
                      onChange={(e) =>
                        setFaixas((prev) =>
                          prev.map((row, idx) =>
                            idx === i ? { ...row, [key]: e.target.value } : row,
                          ),
                        )
                      }
                    />
                  ))}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setFaixas((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editing ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
