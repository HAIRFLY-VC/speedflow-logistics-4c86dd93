import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, FileDown, FileCode, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import { uploadCteXml, getCteXmlUrl } from "@/lib/cte.functions";
import { solicitarCapturaCte, getUltimoComandoCaptura } from "@/lib/cte-captura.functions";
import { CteDetailDialog } from "@/components/ctes/CteDetailDialog";
import { XmlViewerDialog } from "@/components/ctes/XmlViewerDialog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/ctes")({
  component: CtesPage,
  head: () => ({
    meta: [
      { title: "CT-e | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Captura e acompanhamento dos conhecimentos de transporte eletrônicos para auditoria de fretes.",
      },
      { property: "og:title", content: "CT-e | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Importação de XML de CT-e e acompanhamento do status de auditoria.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Cte = Tables<"ctes">;
type Transportadora = Tables<"transportadoras">;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_TONE: Record<string, string> = {
  RECEBIDO: "bg-blue-500/10 text-blue-600",
  PENDENTE_IDENTIFICACAO: "bg-amber-500/10 text-amber-600",
  EM_AUDITORIA: "bg-blue-500/10 text-blue-600",
  APROVADO: "bg-emerald-500/10 text-emerald-600",
  DIVERGENTE: "bg-destructive/10 text-destructive",
  EM_RESOLUCAO: "bg-amber-500/10 text-amber-600",
  RESOLVIDO: "bg-emerald-500/10 text-emerald-600",
  AUTORIZADO: "bg-emerald-500/10 text-emerald-600",
  LANCADO_ERP: "bg-emerald-500/10 text-emerald-600",
  ERRO_ERP: "bg-destructive/10 text-destructive",
  REJEITADO: "bg-destructive/10 text-destructive",
};

function CtesPage() {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<Cte | null>(null);
  const upload = useServerFn(uploadCteXml);
  const signUrl = useServerFn(getCteXmlUrl);
  const solicitarCaptura = useServerFn(solicitarCapturaCte);
  const ultimoComando = useServerFn(getUltimoComandoCaptura);

  const { data: comando } = useQuery({
    queryKey: ["cte-captura-comando"],
    queryFn: () => ultimoComando(),
    refetchInterval: 15_000,
  });

  const forcarImportacao = useMutation({
    mutationFn: async () => solicitarCaptura(),
    onSuccess: (r) => {
      if (r.jaSolicitado) {
        toast.info("Já existe uma importação em andamento. Aguarde a conclusão.");
      } else {
        toast.success("Importação solicitada. O robô buscará os novos CT-e em instantes.");
      }
      void qc.invalidateQueries({ queryKey: ["cte-captura-comando"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capturaEmAndamento =
    comando?.status === "PENDENTE" || comando?.status === "PROCESSANDO";

  const { data: transportadoras } = useQuery({
    queryKey: ["transportadoras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transportadoras").select("*");
      if (error) throw error;
      return data as Transportadora[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ctes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ctes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Cte[];
    },
  });

  const nomeTransportadora = useMemo(() => {
    const map = new Map<string, string>();
    (transportadoras ?? []).forEach((t) => map.set(t.id, t.razao_social));
    return map;
  }, [transportadoras]);

  const [xmlOpen, setXmlOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlTitle, setXmlTitle] = useState("XML do CT-e");

  const readXml = useMutation({
    mutationFn: async (cte: Cte) => {
      const { url } = await signUrl({ data: { cteId: cte.id } });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao carregar o XML");
      return { xml: await res.text(), cte };
    },
    onMutate: (cte: Cte) => {
      setXmlTitle(`XML do CT-e ${cte.numero ?? ""}`.trim());
      setXmlContent(null);
      setXmlOpen(true);
    },
    onSuccess: (r) => setXmlContent(r.xml),
    onError: (e: Error) => {
      setXmlOpen(false);
      toast.error(e.message);
    },
  });

  const openXml = useMutation({
    mutationFn: async (cte: Cte) => {
      const { url } = await signUrl({ data: { cteId: cte.id } });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao baixar o XML");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `cte-${cte.numero ?? cte.id}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const cadastrarTransportadora = useMutation({
    mutationFn: async (cte: Cte) => {
      const cnpj = (cte.cnpj_emitente ?? "").replace(/\D/g, "");
      if (!cnpj) throw new Error("CT-e sem CNPJ do emitente");
      const razao = cte.nome_emitente?.trim() || `Transportadora ${cnpj}`;

      const { data: existente } = await supabase
        .from("transportadoras")
        .select("id")
        .eq("cnpj", cnpj)
        .maybeSingle();

      let id = existente?.id;
      if (!id) {
        const { data: nova, error } = await supabase
          .from("transportadoras")
          .insert({ cnpj, razao_social: razao, ativo: true })
          .select("id")
          .single();
        if (error) throw error;
        id = nova.id;
      }

      const { error: linkErr } = await supabase
        .from("ctes")
        .update({ transportadora_id: id })
        .eq("cnpj_emitente", cte.cnpj_emitente!)
        .is("transportadora_id", null);
      if (linkErr) throw linkErr;
      return razao;
    },
    onSuccess: async (razao) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["transportadoras"] }),
        qc.invalidateQueries({ queryKey: ["ctes"] }),
      ]);
      toast.success(`Transportadora "${razao}" cadastrada`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    let ok = 0;
    let dup = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const xml = await file.text();
        const res = await upload({ data: { xml } });
        if (res.duplicated) dup += 1;
        else ok += 1;
      } catch (e) {
        errors.push(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    qc.invalidateQueries({ queryKey: ["ctes"] });
    if (ok) toast.success(`${ok} CT-e importado(s)`);
    if (dup) toast.info(`${dup} CT-e já cadastrado(s)`);
    errors.forEach((msg) => toast.error(msg));
  }

  const columns = useMemo<ColumnDef<Cte>[]>(
    () => [
      {
        id: "numero",
        header: "CT-e",
        accessor: (c) => c.numero ?? "",
        render: (c) => (
          <div>
            <div className="font-medium">
              {c.numero ?? "—"}
              {c.serie ? <span className="text-muted-foreground">/{c.serie}</span> : null}
            </div>
          </div>
        ),
      },
      {
        id: "transportadora",
        header: "Transportadora",
        accessor: (c) =>
          c.transportadora_id
            ? (nomeTransportadora.get(c.transportadora_id) ?? "—")
            : (c.cnpj_emitente ?? "Não identificada"),
        render: (c) => {
          const cadastrada = c.transportadora_id
            ? (nomeTransportadora.get(c.transportadora_id) ?? null)
            : null;
          const nome = cadastrada ?? c.nome_emitente ?? "Não cadastrada";
          const pendente = !cadastrada && !!c.cnpj_emitente;
          return (
            <div>
              <div className="font-mono text-xs">{c.cnpj_emitente ?? "—"}</div>
              <div className="flex items-center gap-1">
                <span
                  className={
                    cadastrada
                      ? "text-xs font-medium text-emerald-600"
                      : "text-xs font-medium text-destructive"
                  }
                >
                  {nome}
                </span>
                {pendente ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0"
                    title="Cadastrar transportadora com os dados do CT-e"
                    disabled={cadastrarTransportadora.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      cadastrarTransportadora.mutate(c);
                    }}
                  >
                    {cadastrarTransportadora.isPending &&
                    cadastrarTransportadora.variables?.id === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UserPlus className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "emissao",
        header: "Emissão",
        filterType: "date",
        accessor: (c) => c.data_emissao ?? "",
        render: (c) =>
          c.data_emissao ? new Date(c.data_emissao).toLocaleDateString("pt-BR") : "—",
      },
      { id: "uf", header: "UF", align: "center", accessor: (c) => c.uf_destino ?? "—" },
      {
        id: "peso",
        header: "Peso taxado",
        align: "right",
        filterType: "number",
        accessor: (c) => Number(c.peso_taxado ?? 0),
        render: (c) =>
          c.peso_taxado == null ? "—" : `${Number(c.peso_taxado).toLocaleString("pt-BR")} kg`,
      },
      {
        id: "mercadoria",
        header: "Mercadoria",
        align: "right",
        filterType: "number",
        accessor: (c) => Number(c.valor_mercadoria),
        render: (c) => brl(Number(c.valor_mercadoria)),
      },
      {
        id: "frete",
        header: "Frete cobrado",
        align: "right",
        filterType: "number",
        accessor: (c) => Number(c.valor_total_frete),
        render: (c) => (
          <span className="font-medium">{brl(Number(c.valor_total_frete))}</span>
        ),
      },
      {
        id: "perc_frete",
        header: "% Frete",
        align: "right",
        filterType: "number",
        accessor: (c) =>
          Number(c.valor_mercadoria) > 0
            ? (Number(c.valor_total_frete) / Number(c.valor_mercadoria)) * 100
            : 0,
        render: (c) =>
          Number(c.valor_mercadoria) > 0
            ? `${((Number(c.valor_total_frete) / Number(c.valor_mercadoria)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
            : "—",
      },
      {
        id: "origem",
        header: "Origem",
        accessor: (c) => c.origem_captura,
        render: (c) => (c.origem_captura === "MANUAL" ? "Manual" : "Automática"),
      },
      {
        id: "status",
        header: "Status",
        accessor: (c) => c.status,
        render: (c) => (
          <Badge
            variant="secondary"
            className={STATUS_TONE[c.status] ?? "bg-muted text-muted-foreground"}
          >
            {c.status.replaceAll("_", " ")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        sortable: false,
        filterable: false,
        accessor: () => "",
        render: (c) => (
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              title="Ler XML"
              disabled={!c.xml_storage_path || readXml.isPending}
              onClick={(e) => {
                e.stopPropagation();
                readXml.mutate(c);
              }}
            >
              <FileCode className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Baixar XML"
              disabled={!c.xml_storage_path || openXml.isPending}
              onClick={(e) => {
                e.stopPropagation();
                openXml.mutate(c);
              }}
            >
              <FileDown className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nomeTransportadora, openXml.isPending, readXml.isPending],
  );


  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">CT-e</h1>
            <p className="text-muted-foreground text-sm">
              Importe os XML dos conhecimentos de transporte para auditar os fretes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              disabled={forcarImportacao.isPending || capturaEmAndamento}
              onClick={() => forcarImportacao.mutate()}
              title="Solicita ao robô a busca imediata de novos CT-e emitidos contra a empresa"
            >
              {forcarImportacao.isPending || capturaEmAndamento ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {capturaEmAndamento ? "Importando..." : "Forçar importação"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Importar XML
            </Button>
          </div>
        </div>

        <DataTable
          tableKey="ctes"
          columns={columns}
          data={data}
          isLoading={isLoading}
          rowKey={(c) => c.id}
          emptyMessage="Nenhum CT-e importado."
          defaultSort={{ id: "emissao", dir: "desc" }}
          onRowClick={(c) => setSelected(c)}
        />

        <CteDetailDialog
          cte={selected}
          open={!!selected}
          onOpenChange={(v) => !v && setSelected(null)}
          transportadoraNome={
            selected?.transportadora_id
              ? nomeTransportadora.get(selected.transportadora_id)
              : undefined
          }
          statusTone={selected ? STATUS_TONE[selected.status] : undefined}
          onDownloadXml={(c) => openXml.mutate(c)}
          onReadXml={(c) => readXml.mutate(c)}
          downloading={openXml.isPending}
        />

        <XmlViewerDialog
          open={xmlOpen}
          onOpenChange={setXmlOpen}
          xml={xmlContent}
          title={xmlTitle}
          loading={readXml.isPending}
        />
      </div>
    </AppShell>
  );
}
