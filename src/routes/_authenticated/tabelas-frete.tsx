import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Loader2, Trash2, FileText, Upload, Download, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { supabase as storageClient } from "@/integrations/supabase/client";
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
import { useServerFn } from "@tanstack/react-start";
import {
  extractTabelaFrete,
  type ExtractInput,
  type ExtractedTabela,
} from "@/lib/tabela-frete-extract.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/tabelas-frete")({
  component: TabelasFretePage,
  validateSearch: (search: Record<string, unknown>): { tabela?: string } =>
    typeof search.tabela === "string" ? { tabela: search.tabela } : {},
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

type RotaDraft = {
  origem: string;
  destino: string;
  tarifa_frete_peso: string;
  frete_valor_percentual: string;
  taxa_despacho: string;
  frete_minimo: string;
  peso_minimo_kg: string;
  prazo_entrega_min_dias: string;
  prazo_entrega_max_dias: string;
};

const ROTA_VAZIA: RotaDraft = {
  origem: "",
  destino: "",
  tarifa_frete_peso: "0",
  frete_valor_percentual: "0",
  taxa_despacho: "0",
  frete_minimo: "0",
  peso_minimo_kg: "0",
  prazo_entrega_min_dias: "",
  prazo_entrega_max_dias: "",
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

const BUCKET = "tabelas-frete";

async function signedUrl(path: string, download?: string) {
  const { data, error } = await storageClient.storage
    .from(BUCKET)
    .createSignedUrl(path, 300, download ? { download } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

async function abrirArquivo(path: string, nome?: string | null, baixar?: boolean) {
  try {
    const url = await signedUrl(path, baixar ? (nome ?? "tabela") : undefined);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    toast.error((e as Error).message);
  }
}

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
        id: "arquivo",
        header: "Arquivo",
        align: "center",
        sortable: false,
        accessor: (t) => t.arquivo_nome ?? "",
        render: (t) =>
          t.arquivo_path ? (
            <div className="flex items-center justify-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                title={t.arquivo_nome ?? "Ver arquivo"}
                onClick={() => abrirArquivo(t.arquivo_path!)}
              >
                <FileText className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Baixar arquivo"
                onClick={() => abrirArquivo(t.arquivo_path!, t.arquivo_nome, true)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
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
  const [rotas, setRotas] = useState<RotaDraft[]>([]);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arquivoAtual, setArquivoAtual] = useState<{ path: string; nome: string } | null>(
    editing?.arquivo_path
      ? { path: editing.arquivo_path, nome: editing.arquivo_nome ?? "arquivo" }
      : null,
  );

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

  useQuery({
    queryKey: ["tabela-rotas", editing?.id],
    enabled: Boolean(editing?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete_rotas")
        .select("*")
        .eq("tabela_id", editing!.id)
        .order("origem")
        .order("destino");
      if (error) throw error;
      setRotas(
        (data ?? []).map((r) => ({
          origem: r.origem,
          destino: r.destino,
          tarifa_frete_peso: String(r.tarifa_frete_peso),
          frete_valor_percentual: String(r.frete_valor_percentual),
          taxa_despacho: String(r.taxa_despacho),
          frete_minimo: String(r.frete_minimo),
          peso_minimo_kg: String(r.peso_minimo_kg),
          prazo_entrega_min_dias:
            r.prazo_entrega_min_dias == null ? "" : String(r.prazo_entrega_min_dias),
          prazo_entrega_max_dias:
            r.prazo_entrega_max_dias == null ? "" : String(r.prazo_entrega_max_dias),
        })),
      );
      return data;
    },
  });

  const [lendoArquivo, setLendoArquivo] = useState(false);
  const extrair = useServerFn(extractTabelaFrete);

  async function lerArquivo(f: File) {
    setLendoArquivo(true);
    try {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      const payload: ExtractInput = { fileName: f.name };
      if (ext === "csv" || ext === "txt") {
        payload.text = await f.text();
      } else if (ext === "xls" || ext === "xlsx") {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        payload.text = wb.SheetNames.map(
          (n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!)}`,
        ).join("\n\n");
      } else {
        payload.dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Falha ao ler o arquivo"));
          reader.readAsDataURL(f);
        });
      }
      const r = await extrair({ data: payload });
      aplicarExtracao(r);
      toast.success("Campos preenchidos a partir do arquivo. Revise antes de salvar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível ler o arquivo");
    } finally {
      setLendoArquivo(false);
    }
  }

  function aplicarExtracao(r: ExtractedTabela) {
    const s = (v: number | null | undefined) => (v == null ? undefined : String(v));
    setForm((f) => {
      const cnpj = (r.transportadora_cnpj ?? "").replace(/\D/g, "");
      const alvo =
        (cnpj ? transportadoras.find((t) => t.cnpj.replace(/\D/g, "") === cnpj) : undefined) ??
        (r.transportadora_nome
          ? transportadoras.find((t) =>
              t.razao_social.toLowerCase().includes(r.transportadora_nome!.toLowerCase().slice(0, 8)),
            )
          : undefined);
      return {
        ...f,
        transportadora_id: alvo?.id ?? f.transportadora_id,
        nome: r.nome?.trim() || f.nome,
        descricao: r.descricao?.trim() || f.descricao,
        data_inicio: r.data_inicio || f.data_inicio,
        data_fim: r.data_fim || f.data_fim,
        tipo_calculo: r.tipo_calculo ?? f.tipo_calculo,
        percentual_valor: s(r.percentual_valor) ?? f.percentual_valor,
        gris_percentual: s(r.gris_percentual) ?? f.gris_percentual,
        ad_valorem_percentual: s(r.ad_valorem_percentual) ?? f.ad_valorem_percentual,
        pedagio_valor: s(r.pedagio_valor) ?? f.pedagio_valor,
        tas_valor: s(r.tas_valor) ?? f.tas_valor,
        frete_minimo: s(r.frete_minimo) ?? f.frete_minimo,
        icms_percentual: s(r.icms_percentual) ?? f.icms_percentual,
        uf_destino: r.uf_destino?.toUpperCase().slice(0, 2) || f.uf_destino,
      };
    });
    if (r.faixas?.length) {
      setFaixas(
        r.faixas.map((fx) => ({
          peso_de: String(fx.peso_de ?? 0),
          peso_ate: fx.peso_ate == null ? "" : String(fx.peso_ate),
          valor_por_kg: String(fx.valor_por_kg ?? 0),
          valor_fixo_faixa: String(fx.valor_fixo_faixa ?? 0),
        })),
      );
    }
    if (r.rotas?.length) {
      // Células mescladas (origem, taxa de despacho, peso mínimo) vêm vazias nas
      // linhas seguintes: herdamos o último valor preenchido.
      let ultOrigem = "";
      let ultDespacho = 0;
      let ultPesoMin =
        r.rotas.find((ro) => (ro.peso_minimo_kg ?? 0) > 0)?.peso_minimo_kg ?? 50;
      setRotas(
        r.rotas.map((ro) => {
          const origem = (ro.origem ?? "").trim() || ultOrigem;
          ultOrigem = origem || ultOrigem;
          const despacho = ro.taxa_despacho && ro.taxa_despacho > 0 ? ro.taxa_despacho : ultDespacho;
          ultDespacho = despacho || ultDespacho;
          const pesoMin =
            ro.peso_minimo_kg && ro.peso_minimo_kg > 0 ? ro.peso_minimo_kg : ultPesoMin;
          ultPesoMin = pesoMin || ultPesoMin;
          return {
            origem,
            destino: (ro.destino ?? "").trim(),
            tarifa_frete_peso: String(ro.tarifa_frete_peso ?? 0),
            frete_valor_percentual: String(ro.frete_valor_percentual ?? 0),
            taxa_despacho: String(despacho),
            frete_minimo: String(ro.frete_minimo ?? 0),
            peso_minimo_kg: String(pesoMin),
            prazo_entrega_min_dias:
              ro.prazo_entrega_min_dias == null ? "" : String(ro.prazo_entrega_min_dias),
            prazo_entrega_max_dias:
              ro.prazo_entrega_max_dias == null ? "" : String(ro.prazo_entrega_max_dias),
          };
        }),
      );
    }
  }

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

      if (arquivo) {
        const ext = arquivo.name.split(".").pop()?.toLowerCase() ?? "bin";
        const path = `${tabelaId}/${Date.now()}.${ext}`;
        const { error: upErr } = await storageClient.storage
          .from(BUCKET)
          .upload(path, arquivo, { contentType: arquivo.type || undefined, upsert: false });
        if (upErr) throw upErr;
        const { error: metaErr } = await supabase
          .from("tabelas_preco_frete")
          .update({
            arquivo_path: path,
            arquivo_nome: arquivo.name,
            arquivo_tipo: arquivo.type || null,
          })
          .eq("id", tabelaId);
        if (metaErr) throw metaErr;
        if (arquivoAtual?.path) {
          await storageClient.storage.from(BUCKET).remove([arquivoAtual.path]);
        }
      } else if (!arquivoAtual && editing?.arquivo_path) {
        const { error: metaErr } = await supabase
          .from("tabelas_preco_frete")
          .update({ arquivo_path: null, arquivo_nome: null, arquivo_tipo: null })
          .eq("id", tabelaId);
        if (metaErr) throw metaErr;
        await storageClient.storage.from(BUCKET).remove([editing.arquivo_path]);
      }



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

      const { error: delRotas } = await supabase
        .from("tabelas_preco_frete_rotas")
        .delete()
        .eq("tabela_id", tabelaId);
      if (delRotas) throw delRotas;

      const rotaRows = rotas
        .filter((r) => r.origem.trim() !== "" || r.destino.trim() !== "")
        .map((r) => ({
          tabela_id: tabelaId!,
          origem: r.origem.trim(),
          destino: r.destino.trim(),
          tarifa_frete_peso: num(r.tarifa_frete_peso),
          frete_valor_percentual: num(r.frete_valor_percentual),
          taxa_despacho: num(r.taxa_despacho),
          frete_minimo: num(r.frete_minimo),
          peso_minimo_kg: num(r.peso_minimo_kg),
          prazo_entrega_min_dias:
            r.prazo_entrega_min_dias === "" ? null : Math.round(num(r.prazo_entrega_min_dias)),
          prazo_entrega_max_dias:
            r.prazo_entrega_max_dias === "" ? null : Math.round(num(r.prazo_entrega_max_dias)),
        }));
      if (rotaRows.length) {
        const { error } = await supabase.from("tabelas_preco_frete_rotas").insert(rotaRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
      qc.invalidateQueries({ queryKey: ["tabela-faixas"] });
      qc.invalidateQueries({ queryKey: ["tabela-rotas"] });
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
          <div className="md:col-span-3 space-y-1.5">
            <Label className="text-xs">Arquivo da tabela (PDF, Excel, imagem)</Label>
            <div className="rounded-md border border-dashed p-3 space-y-2">
              {arquivo ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{arquivo.name}</span>
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => setArquivo(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : arquivoAtual ? (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    className="flex items-center gap-2 truncate text-primary hover:underline"
                    onClick={() => abrirArquivo(arquivoAtual.path)}
                  >
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{arquivoAtual.nome}</span>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Baixar"
                      onClick={() => abrirArquivo(arquivoAtual.path, arquivoAtual.nome, true)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Remover arquivo"
                      onClick={() => setArquivoAtual(null)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Anexe o arquivo original enviado pela transportadora. Ele ficará guardado no app
                  para consulta.
                </p>
              )}

              <Input
                type="file"
                accept=".pdf,.xls,.xlsx,.csv,.png,.jpg,.jpeg"
                disabled={lendoArquivo}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  if (f && f.size > 20 * 1024 * 1024) {
                    toast.error("Arquivo maior que 20 MB");
                    return;
                  }
                  setArquivo(f);
                  if (f) void lerArquivo(f);
                }}
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                {lendoArquivo ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" /> Lendo o arquivo e preenchendo os
                    campos…
                  </>
                ) : (
                  <>
                    <Upload className="h-3 w-3" /> Até 20 MB. Os campos abaixo são preenchidos
                    automaticamente a partir do arquivo.
                  </>
                )}
              </p>
            </div>
          </div>
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
            <div>
              <Label className="text-sm font-medium">Preços por origem e destino</Label>
              <p className="text-xs text-muted-foreground">
                Use quando a tabela cobra valores e prazos diferentes por rota.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setRotas((r) => [...r, { ...ROTA_VAZIA }])}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar rota
            </Button>
          </div>

          {rotas.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhuma rota cadastrada. Os valores gerais acima serão usados para todos os destinos.
            </p>
          ) : (
            <div className="space-y-2 overflow-x-auto">
              <div className="grid min-w-[900px] grid-cols-[1.2fr_1.6fr_0.9fr_0.8fr_0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_auto] gap-2 text-xs text-muted-foreground">
                <span>Origem</span>
                <span>Destino</span>
                <span>Tarifa/kg</span>
                <span>% Valor</span>
                <span>Despacho</span>
                <span>Frete mín.</span>
                <span>Peso mín. (kg)</span>
                <span>Prazo de</span>
                <span>Prazo até</span>
                <span />
              </div>
              {rotas.map((r, i) => (
                <div
                  key={i}
                  className="grid min-w-[900px] grid-cols-[1.2fr_1.6fr_0.9fr_0.8fr_0.9fr_0.9fr_0.8fr_0.7fr_0.7fr_auto] gap-2 items-center"
                >
                  {(
                    [
                      "origem",
                      "destino",
                      "tarifa_frete_peso",
                      "frete_valor_percentual",
                      "taxa_despacho",
                      "frete_minimo",
                      "peso_minimo_kg",
                      "prazo_entrega_min_dias",
                      "prazo_entrega_max_dias",
                    ] as (keyof RotaDraft)[]
                  ).map((key) => (
                    <Input
                      key={key}
                      inputMode={key === "origem" || key === "destino" ? "text" : "decimal"}
                      value={r[key]}
                      onChange={(e) =>
                        setRotas((prev) =>
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
                    onClick={() => setRotas((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
