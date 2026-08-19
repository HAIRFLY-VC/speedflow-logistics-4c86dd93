import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { openAppRoute } from "@/lib/open-in-tab";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Loader2, FileDown, FileCode, UserPlus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";


import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import { uploadCteXml, getCteXmlUrl } from "@/lib/cte.functions";
import {
  solicitarCapturaCte,
  getUltimoComandoCaptura,
  cancelarCapturaCte,
  getStatusRobo,
} from "@/lib/cte-captura.functions";
import { getStatusErpCtes } from "@/lib/cte-status-erp.functions";
import { definirStatusManualCte } from "@/lib/cte-status-manual.functions";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  backfillNomeDestinatario,
  reprocessarIdentificacaoCtes,
} from "@/lib/cte-backfill.functions";

import { XmlViewerDialog } from "@/components/ctes/XmlViewerDialog";
import { PAPEL_LABEL } from "@/lib/cte-tomador";
import type { Tables } from "@/integrations/supabase/types";



export const Route = createFileRoute("/_authenticated/ctes/")({
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
type Empresa = Tables<"empresas">;
type CteRow = Cte & { empresas: Pick<Empresa, "id" | "cnpj" | "razao_social"> | null };


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
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = useServerFn(uploadCteXml);
  const signUrl = useServerFn(getCteXmlUrl);
  const solicitarCaptura = useServerFn(solicitarCapturaCte);
  const ultimoComando = useServerFn(getUltimoComandoCaptura);
  const cancelarCaptura = useServerFn(cancelarCapturaCte);
  const statusRobo = useServerFn(getStatusRobo);
  const backfillDestinatarios = useServerFn(backfillNomeDestinatario);
  const reprocessarIdentificacao = useServerFn(reprocessarIdentificacaoCtes);

  const { data: robo } = useQuery({

    queryKey: ["robo-status"],
    queryFn: () => statusRobo(),
    refetchInterval: 30_000,
  });


  const { data: comando } = useQuery({
    queryKey: ["cte-captura-comando"],
    queryFn: () => ultimoComando(),
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | null | undefined)?.status;
      return s === "PENDENTE" || s === "PROCESSANDO" ? 8_000 : 30_000;
    },
  });

  const forcarImportacao = useMutation({
    mutationFn: async (reiniciarNsu: boolean = false) =>
      solicitarCaptura({ data: { reiniciarNsu } }),
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

  const cancelarImportacao = useMutation({
    mutationFn: async () => cancelarCaptura(),
    onSuccess: () => {
      toast.info("Importação cancelada.");
      void qc.invalidateQueries({ queryKey: ["cte-captura-comando"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const capturaEmAndamento =
    comando?.status === "PENDENTE" || comando?.status === "PROCESSANDO";

  const roboOnline = Boolean(robo?.online);
  const textoDesdeUltimoContato = robo?.ultimoContato
    ? formatDistanceToNow(new Date(robo.ultimoContato), { locale: ptBR })
    : "";

  // Sem robô ativo o pedido só expira depois de 5 minutos: avisa antes de criar.
  const solicitarComAviso = (reiniciarNsu: boolean) => {
    if (!roboOnline) {
      const detalhe = robo?.ultimoContato
        ? `O robô está sem contato há ${textoDesdeUltimoContato} (último em ${new Date(
            robo.ultimoContato,
          ).toLocaleString("pt-BR")}).`
        : "O robô nunca entrou em contato com o aplicativo.";
      if (
        !window.confirm(
          `${detalhe}\n\nO pedido pode ficar aguardando e falhar em alguns minutos. Verifique se o serviço RoboCTeSpeedFlow está ativo no servidor.\n\nDeseja solicitar mesmo assim?`,
        )
      )
        return;
    }
    forcarImportacao.mutate(reiniciarNsu);
  };




  // Tempo decorrido desde a solicitação, para o usuário saber que está aguardando o robô.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (!capturaEmAndamento) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [capturaEmAndamento]);
  const segundosEsperando = capturaEmAndamento
    ? Math.max(0, Math.floor((agora - new Date(comando!.created_at as string).getTime()) / 1000))
    : 0;


  const capturaAnterior = useRef<string | null>(null);
  useEffect(() => {
    const atual = comando ? `${comando.id}:${comando.status}` : null;
    if (
      capturaAnterior.current &&
      atual !== capturaAnterior.current &&
      (comando?.status === "CONCLUIDO" || comando?.status === "ERRO")
    ) {
      void qc.invalidateQueries({ queryKey: ["ctes"] });
      if (comando.status === "CONCLUIDO") {
        toast.success(`Importação concluída: ${comando.novos_ctes ?? 0} CT-e processados.`);
      } else {
        toast.error(`Falha na importação: ${comando.mensagem ?? "erro desconhecido"}`);
      }
    }
    capturaAnterior.current = atual;
  }, [comando, qc]);

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
        .select("*, empresas:empresa_id (id, cnpj, razao_social)")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as CteRow[];
    },
  });

  const statusErp = useServerFn(getStatusErpCtes);
  const cteIds = useMemo(() => (data ?? []).map((c) => c.id), [data]);
  const { data: statusMap } = useQuery({
    queryKey: ["ctes-status-erp", cteIds],
    enabled: cteIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const linhas = await statusErp({ data: { cteIds } });
      return new Map(linhas.map((l) => [l.cteId, l]));
    },
  });

  const { role } = useAuth();
  const isAdm = role === "adm";
  const definirStatus = useServerFn(definirStatusManualCte);
  const mStatusManual = useMutation({
    mutationFn: async (vars: {
      cteId: string;
      valores?: "PENDENTE" | "APROVADO" | "REPROVADO" | null;
      financeiro?: boolean | null;
    }) => await definirStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado.");
      void qc.invalidateQueries({ queryKey: ["ctes-status-erp"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backfillDestinatariosMutation = useMutation({
    mutationFn: () => backfillDestinatarios({}),
    onSuccess: (r) => {
      if (r.atualizados > 0) {
        toast.success(`${r.atualizados} nomes de destinatários atualizados.`);
        void qc.invalidateQueries({ queryKey: ["ctes"] });
      }
    },
    onError: (err) => {
      console.error("Backfill destinatários falhou:", err);
    },
  });

  const reprocessarTomadores = useMutation({
    mutationFn: (somentePendentes: boolean) =>
      reprocessarIdentificacao({ data: { somentePendentes } }),
    onSuccess: (r) => {
      toast.success(
        `${r.processados} CT-e reprocessados — ${r.identificados} com empresa identificada, ${r.pendentes} pendentes.`,
      );
      void qc.invalidateQueries({ queryKey: ["ctes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  useEffect(() => {
    if (!data) return;
    const faltantes = data.some((c) => !c.nome_destinatario && c.xml_storage_path);
    if (faltantes) {
      backfillDestinatariosMutation.mutate();
    }
  }, [data]);






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
      const { xml } = await signUrl({ data: { cteId: cte.id } });
      return { xml, cte };
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
      const { xml } = await signUrl({ data: { cteId: cte.id } });
      const blob = new Blob([xml], { type: "application/xml" });
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

  const columns = useMemo<ColumnDef<CteRow>[]>(
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
                      ? "text-[11px] font-medium text-emerald-600"
                      : "text-[11px] font-medium text-destructive"
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
        id: "tomador",
        header: "Tomador",
        accessor: (c) => c.tomador_nome ?? c.tomador_cnpj ?? "",
        render: (c) => {
          if (!c.tomador_cnpj && !c.tomador_nome) {
            return (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                Tomador não identificado
              </Badge>
            );
          }
          return (
            <div>
              <div className="font-mono text-xs">{c.tomador_cnpj ?? "—"}</div>
              <div className="text-[11px] font-medium">
                <span className={c.empresa_id ? "text-emerald-600" : "text-destructive"}>
                  {c.tomador_nome ?? "—"}
                </span>
                {c.tomador_papel ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({PAPEL_LABEL[c.tomador_papel] ?? c.tomador_papel})
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        id: "destinatario",
        header: "Destinatário",
        accessor: (c) => c.nome_destinatario ?? c.cnpj_destinatario ?? "",
        render: (c) => (
          <div>
            <div className="font-mono text-xs">{c.cnpj_destinatario ?? "—"}</div>
            <div className="text-[11px] font-medium text-muted-foreground">
              {c.nome_destinatario ?? "—"}
            </div>
          </div>
        ),
      },
      {
        id: "emissao",
        header: "Emissão",
        filterType: "date",
        accessor: (c) => c.data_emissao ?? "",
        render: (c) => {
          if (!c.data_emissao) return "—";
          const d = new Date(c.data_emissao);
          return (
            <div>
              <div>{d.toLocaleDateString("pt-BR")}</div>
              <div className="text-[11px] text-muted-foreground">
                {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </div>
            </div>
          );
        },
      },
      {
        id: "tipo",
        header: "Tipo",
        align: "center",
        accessor: (c) =>
          c.tipo_cte === 4
            ? "Reentrega"
            : c.tipo_cte === 5
              ? "Devolução"
              : Number(c.peso_taxado) > 0
                ? "Normal"
                : "Complementar",
        render: (c) => {
          const reentrega = c.tipo_cte === 4;
          const devolucao = c.tipo_cte === 5;
          const normal = !reentrega && !devolucao && Number(c.peso_taxado) > 0;
          const label = reentrega ? "R" : devolucao ? "D" : normal ? "N" : "C";
          const tooltip = reentrega
            ? "Reentrega"
            : devolucao
              ? "Devolução"
              : normal
                ? "Normal"
                : "Complementar";
          return (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="secondary"
                    className={
                      reentrega
                        ? "bg-purple-500/10 text-purple-600 cursor-default"
                        : devolucao
                          ? "bg-teal-500/10 text-teal-600 cursor-default"
                          : normal
                            ? "bg-blue-500/10 text-blue-600 cursor-default"
                            : "bg-amber-500/10 text-amber-600 cursor-default"
                    }
                  >
                    {label}
                  </Badge>

                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      { id: "uf", header: "UF", align: "center", accessor: (c) => c.uf_destino ?? "—" },
      {
        id: "peso",
        header: "Peso taxado",
        align: "right",
        filterType: "number",
        accessor: (c) => Number(c.peso_taxado ?? 0),
        render: (c) =>
          c.peso_taxado == null
            ? "—"
            : `${Number(c.peso_taxado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`,
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
        id: "contabilizado",
        header: "Valores",
        align: "center",
        accessor: (c) => statusMap?.get(c.id)?.contabilizado ?? "PENDENTE",
        render: (c) => {
          const info = statusMap?.get(c.id);
          const st = info?.contabilizado ?? "PENDENTE";
          const tone =
            st === "APROVADO"
              ? "bg-emerald-500/10 text-emerald-600"
              : st === "REPROVADO"
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground";
          const label =
            st === "APROVADO" ? "Contabilizado" : st === "REPROVADO" ? "Reprovado" : "Pendente";
          const badge = (
            <Badge variant="secondary" className={tone}>
              {label}
              {info?.contabilizadoManual ? " *" : ""}
            </Badge>
          );
          if (!isAdm) return badge;
          return (
            <div onClick={(e) => e.stopPropagation()} className="inline-block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cursor-pointer">
                  {badge}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuLabel className="text-xs font-normal">
                  Alterar status (não dispara o ERP)
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() =>
                    mStatusManual.mutate({ cteId: c.id, valores: "APROVADO" })
                  }
                >
                  Contabilizado
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    mStatusManual.mutate({ cteId: c.id, valores: "PENDENTE" })
                  }
                >
                  Pendente
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    mStatusManual.mutate({ cteId: c.id, valores: "REPROVADO" })
                  }
                >
                  Reprovado
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => mStatusManual.mutate({ cteId: c.id, valores: null })}
                >
                  Automático (seguir aprovação)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          );
        },
      },
      {
        id: "financeiro",
        header: "Financeiro",
        align: "center",
        accessor: (c) => {
          const f = statusMap?.get(c.id)?.financeiro;
          return f == null ? "" : f ? "Lançado" : "Não lançado";
        },
        render: (c) => {
          const info = statusMap?.get(c.id);
          const marca = info?.financeiroManual ? " *" : "";
          let conteudo: ReactNode;
          if (!info || info.financeiro == null) {
            conteudo = <span className="text-muted-foreground text-xs">—</span>;
          } else if (!info.financeiro) {
            conteudo = (
              <Badge variant="secondary" className="bg-muted text-muted-foreground">
                Não lançado{marca}
              </Badge>
            );
          } else {
            const detalhe = [
              info.vencimento
                ? `Vencimento ${new Date(`${info.vencimento}T00:00:00`).toLocaleDateString("pt-BR")}`
                : null,
              info.valor != null ? brl(Number(info.valor)) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            conteudo = (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                      Lançado{marca}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{detalhe || "Lançado no financeiro do ERP"}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          }
          if (!isAdm) return conteudo;
          return (
            <div onClick={(e) => e.stopPropagation()} className="inline-block">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="cursor-pointer">
                  {conteudo}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuLabel className="text-xs font-normal">
                  Alterar status (não dispara o ERP)
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onClick={() => mStatusManual.mutate({ cteId: c.id, financeiro: true })}
                >
                  Lançado
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => mStatusManual.mutate({ cteId: c.id, financeiro: false })}
                >
                  Não lançado
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => mStatusManual.mutate({ cteId: c.id, financeiro: null })}
                >
                  Automático (consultar ERP)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </div>
          );
        },
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
    [nomeTransportadora, openXml.isPending, readXml.isPending, statusMap, isAdm],
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
              onClick={() => solicitarComAviso(false)}
              title="Solicita ao robô a busca imediata de novos CT-e emitidos contra a empresa"
            >
              {forcarImportacao.isPending || capturaEmAndamento ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              {capturaEmAndamento
                ? `Aguardando robô (${segundosEsperando}s)`
                : "Forçar importação"}
            </Button>
            <Button
              variant="outline"
              disabled={forcarImportacao.isPending || capturaEmAndamento}
              onClick={() => {
                if (
                  window.confirm(
                    "Reimportar todos os CT-e desde o início? O robô fará uma varredura completa na SEFAZ.",
                  )
                )
                  solicitarComAviso(true);
              }}
              title="Reprocessa todos os CT-e disponíveis na SEFAZ desde o primeiro documento"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Reimportar tudo
            </Button>
            <Button
              variant="outline"
              disabled={reprocessarTomadores.isPending}
              onClick={() => reprocessarTomadores.mutate(false)}
              title="Relê os XML já armazenados e identifica o tomador do serviço de cada CT-e"
            >
              {reprocessarTomadores.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1" />
              )}
              Reprocessar tomadores
            </Button>
            {capturaEmAndamento && (
              <Button
                variant="ghost"
                disabled={cancelarImportacao.isPending}
                onClick={() => cancelarImportacao.mutate()}
              >
                Cancelar
              </Button>
            )}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs ${
                roboOnline
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                  : "border-destructive/30 bg-destructive/10 text-destructive"
              }`}
              title={
                robo?.ultimoContato
                  ? `Último contato: ${new Date(robo.ultimoContato).toLocaleString("pt-BR")}`
                  : "O robô ainda não entrou em contato com o aplicativo"
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  roboOnline ? "bg-emerald-500" : "bg-destructive"
                }`}
              />
              {roboOnline
                ? `Robô ativo${robo?.estado ? ` — ${robo.estado}` : ""}`
                : robo?.ultimoContato
                  ? `Robô offline (sem contato há ${textoDesdeUltimoContato})`
                  : "Robô nunca contatou o aplicativo"}
            </span>

            <span
              className="text-muted-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
              title={
                robo?.varreduraNfe?.ultimoContato
                  ? `Última varredura: ${new Date(
                      robo.varreduraNfe.ultimoContato,
                    ).toLocaleString("pt-BR")}`
                  : "A versão instalada do robô ainda não executa a varredura de NF-e por NSU"
              }
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  robo?.varreduraNfe ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {robo?.varreduraNfe
                ? `Varredura NF-e${
                    robo.varreduraNfe.detalhe ? ` — ${robo.varreduraNfe.detalhe}` : ""
                  }`
                : "Varredura NF-e não executada (atualize o robô)"}
            </span>






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
          onRowClick={(c) => {
            openAppRoute(router, `/ctes/${c.id}`);
          }}
          scrollable
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
