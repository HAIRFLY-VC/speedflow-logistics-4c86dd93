import { AlertTriangle, CheckCircle2, FileCode, FileDown, Loader2, ScanSearch } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouter } from "@tanstack/react-router";
import { openAppRoute, appLinkTarget } from "@/lib/open-in-tab";

import { toast } from "sonner";

import { auditarCte } from "@/lib/cte-audit.functions";

import { PracaOverrideDialog } from "@/components/ctes/PracaOverrideDialog";
import { getVolumesNfesDoCte } from "@/lib/cte.functions";
import { getFretesContabilizadosNfes } from "@/lib/frete-nfe-erp.functions";
import type { FreteContabilizadoNfe } from "@/lib/frete-nfe-erp.types";
import type { NfeVolumeInfo } from "@/lib/nfe-volumes.types";
import { obterEnderecoEntregaCte, resolverNomeDestinatario } from "@/lib/cte-backfill.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/central/client";
import { PAPEL_LABEL } from "@/lib/cte-tomador";
import type { Tables } from "@/integrations/supabase/types";

type Cte = Tables<"ctes">;

function statusLabel(
  status: NfeVolumeInfo["status"] | undefined,
  loading: boolean,
  mensagem?: string | null,
) {
  if (loading && !status) return "...";
  // 641 = nota emitida pela própria empresa: chega pela varredura por NSU do robô.
  if (status === "AGUARDANDO_VARREDURA" || /\b641\b/.test(mensagem ?? ""))
    return "aguardando varredura";
  switch (status) {
    case "PENDENTE":
      return "aguardando XML";
    case "PROCESSANDO":
      return "baixando...";
    case "ERRO":
      return "erro no download";
    default:
      return "—";
  }
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dataBr = (v: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString("pt-BR");
};

const horaBr = (v: string | null) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

const dataHoraCelula = (v: string | null) => {
  const hora = horaBr(v);
  return (
    <div className="leading-tight">
      <div>{dataBr(v)}</div>
      {hora ? <div className="text-muted-foreground text-[10px]">{hora}</div> : null}
    </div>
  );
};

function Field({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium break-words">{value ?? "—"}</div>
      {hint ? <div className="text-muted-foreground text-xs break-words">{hint}</div> : null}
    </div>
  );
}

export type CteLinkMode = "same" | "dialog" | "window";

export function CteDetailView({
  cte,
  transportadoraNome,
  statusTone,
  onDownloadXml,
  onReadXml,
  downloading,
  onOpenCte,
  linkMode = "dialog",
}: {
  cte: Cte;
  transportadoraNome?: string;
  statusTone?: string;
  onDownloadXml: (cte: Cte) => void;
  onReadXml: (cte: Cte) => void;
  downloading: boolean;
  onOpenCte?: (cteId: string) => void;
  linkMode?: CteLinkMode;
}) {
  const router = useRouter();

  const { data: auditorias } = useQuery({
    queryKey: ["cte-auditorias", cte.id],
    enabled: !!cte.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cte_auditorias")
        .select("*")
        .eq("cte_id", cte.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });


  const isReentrega = cte.tipo_cte === 4;
  const isDevolucao = cte.tipo_cte === 5;
  const isComplemento =
    cte.tipo_cte === 1 ||
    isReentrega ||
    !!cte.chave_cte_complementado ||
    !!cte.numero_cte_complementado;
  const isComplementar =
    cte.tipo_cte === 1 ||
    (!isReentrega && !isDevolucao && !(Number(cte.peso_taxado) > 0));
  const isVinculado = isComplementar || isReentrega;

  const { data: grupo } = useQuery({
    queryKey: [
      "cte-grupo",
      cte.id,
      cte.chave_cte_complementado,
      cte.numero_cte_complementado,
    ],
    enabled: !!cte.id,
    queryFn: async () => {
      const cols =
        "id, numero, chave_acesso, valor_total_frete, motivo_complemento, nfs_referenciadas, tipo_cte";
      let q;
      if (cte.chave_cte_complementado) {
        q = supabase
          .from("ctes")
          .select(cols)
          .eq("chave_acesso", cte.chave_cte_complementado);
      } else if (isVinculado && cte.numero_cte_complementado && cte.cnpj_emitente) {
        q = supabase
          .from("ctes")
          .select(cols)
          .eq("cnpj_emitente", cte.cnpj_emitente)
          .eq("numero", cte.numero_cte_complementado);
      } else if (cte.numero && cte.cnpj_emitente) {
        q = supabase
          .from("ctes")
          .select(cols)
          .eq("cnpj_emitente", cte.cnpj_emitente)
          .or(
            `chave_cte_complementado.eq.${cte.chave_acesso},numero_cte_complementado.eq.${cte.numero}`,
          );
      } else {
        q = supabase.from("ctes").select(cols).eq("chave_cte_complementado", cte.chave_acesso);
      }
      const { data, error } = await q;
      if (error) throw error;
      // Reentregas são auditadas isoladamente: não entram no grupo do original.
      return (data ?? []).filter(
        (g) => g.id !== cte.id && (isVinculado || g.tipo_cte !== 4),
      );
    },
  });

  const resolverNome = useServerFn(resolverNomeDestinatario);
  const { data: nomeDestinatario } = useQuery({
    queryKey: ["cte-nome-destinatario", cte.id, cte.cnpj_destinatario],
    enabled: !!cte.cnpj_destinatario && !cte.nome_destinatario,
    queryFn: async () => {
      const cnpj = cte.cnpj_destinatario!;
      try {
        const res = await resolverNome({ data: { cteId: cte.id } });
        if (res?.nome) return res.nome;
      } catch {
        // segue para os cadastros locais
      }
      const { data: nfe } = await supabase
        .from("nfes")
        .select("nome_destinatario")
        .eq("cnpj_destinatario", cnpj)
        .limit(1)
        .maybeSingle();
      if (nfe?.nome_destinatario) return nfe.nome_destinatario;
      const { data: cli } = await supabase
        .from("customers")
        .select("legal_name")
        .eq("cnpj", cnpj)
        .limit(1)
        .maybeSingle();
      if (cli?.legal_name) return cli.legal_name;
      const { data: emp } = await supabase
        .from("empresas")
        .select("razao_social")
        .eq("cnpj", cnpj)
        .limit(1)
        .maybeSingle();
      if (emp?.razao_social) return emp.razao_social;
      const { data: tra } = await supabase
        .from("transportadoras")
        .select("razao_social")
        .eq("cnpj", cnpj)
        .limit(1)
        .maybeSingle();
      return tra?.razao_social ?? null;
    },
  });

  const obterEndereco = useServerFn(obterEnderecoEntregaCte);
  const { data: enderecoEntrega } = useQuery({
    queryKey: ["cte-endereco-entrega", cte.id],
    enabled: !!cte.id && !!cte.xml_storage_path,
    queryFn: async () => {
      const res = await obterEndereco({ data: { cteId: cte.id } });
      return res?.endereco ?? null;
    },
  });

  const qc = useQueryClient();
  const runAudit = useServerFn(auditarCte);
  const audit = useMutation({
    mutationFn: (cteId: string) => runAudit({ data: { cteId } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["cte-auditorias", cte.id] });
      qc.invalidateQueries({ queryKey: ["ctes"] });
      if (res.resultado === "OK") toast.success("Auditoria OK: cobrança bate com a tabela.");
      else
        toast.error(
          `Divergência encontrada: ${brl(Number(res.diferenca))} (${Number(res.percentual_diferenca).toFixed(2)}%)`,
        );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao auditar"),
  });

  const ultimaAuditoria = auditorias?.[0];

  const { data: tabelaUsada } = useQuery({
    queryKey: ["cte-tabela-auditoria", ultimaAuditoria?.tabela_preco_id],
    enabled: !!ultimaAuditoria?.tabela_preco_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("id, nome, data_inicio, data_fim, uf_destino, tipo_calculo")
        .eq("id", ultimaAuditoria!.tabela_preco_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  const componentes = (Array.isArray(cte.componentes) ? cte.componentes : []) as {
    nome?: string;
    valor?: number;
  }[];
  const nfsProprias = (Array.isArray(cte.nfs_referenciadas) ? cte.nfs_referenciadas : []) as string[];
  const cteOriginal = isVinculado ? (grupo?.[0] ?? null) : null;
  const nfsDoOriginal = (
    Array.isArray(cteOriginal?.nfs_referenciadas) ? cteOriginal!.nfs_referenciadas : []
  ) as string[];
  const usandoNfsDoOriginal = nfsProprias.length === 0 && nfsDoOriginal.length > 0;
  const nfs = usandoNfsDoOriginal ? nfsDoOriginal : nfsProprias;

  const buscarVolumes = useServerFn(getVolumesNfesDoCte);
  // Complementar/reentrega não tem carga própria: os totais vêm do CT-e original.
  const cteIdCarga = usandoNfsDoOriginal && cteOriginal?.id ? cteOriginal.id : cte.id;
  const { data: volumesResp, isFetching: volumesLoading } = useQuery({
    queryKey: ["cte-nfes-volumes", cteIdCarga, nfs.join(",")],
    enabled: nfs.length > 0,
    queryFn: async () => await buscarVolumes({ data: { chaves: nfs, cteId: cteIdCarga } }),
    refetchInterval: (q) =>
      (q.state.data?.notas ?? []).some((n) => n.status !== "DISPONIVEL") ? 60_000 : false,
  });
  const volumesData = volumesResp?.notas ?? [];
  const carga = volumesResp?.carga ?? null;
  const volumesMap = new Map<string, NfeVolumeInfo>(volumesData.map((n) => [n.chave, n]));
  const totalVolumes = volumesData.reduce((s, n) => s + (n.volumes ?? 0), 0);
  const totalPesoBruto = volumesData.reduce((s, n) => s + (n.peso_bruto ?? 0), 0);
  // Sem XML das notas, exibimos os totais declarados no próprio CT-e.
  const usandoCargaDoCte = totalVolumes === 0 && totalPesoBruto === 0 && !!carga;
  const volumesExibidos = usandoCargaDoCte ? (carga?.volumes ?? 0) : totalVolumes;
  const pesoExibido = usandoCargaDoCte
    ? (carga?.peso_real ?? Number(cte.peso_taxado ?? 0) ?? 0)
    : totalPesoBruto;
  // Com uma única NF-e no CT-e, a carga declarada corresponde a ela: mostramos
  // esses números na linha enquanto o XML da nota não é capturado.
  const cargaNaLinha = usandoCargaDoCte && nfs.length === 1 ? carga : null;

  // Despesas de frete já lançadas no ERP para as notas do CT-e.
  const buscarFretesErp = useServerFn(getFretesContabilizadosNfes);
  const { data: fretesErp } = useQuery({
    queryKey: ["cte-nfes-frete-erp", cteIdCarga, nfs.join(",")],
    enabled: nfs.filter((n) => /^\d{44}$/.test(n)).length > 0,
    queryFn: async () =>
      await buscarFretesErp({
        data: { cteId: cteIdCarga, chaves: nfs.filter((n) => /^\d{44}$/.test(n)) },
      }),
    staleTime: 5 * 60_000,
  });
  const fretesPorChave = new Map<string, FreteContabilizadoNfe[]>();
  for (const item of (fretesErp?.itens ?? []) as FreteContabilizadoNfe[]) {
    const atual = fretesPorChave.get(item.chave) ?? [];
    atual.push(item);
    fretesPorChave.set(item.chave, atual);
  }
  const totalFreteErp = (fretesErp?.itens ?? []).reduce((s: number, i: FreteContabilizadoNfe) => s + i.total, 0);


  // Complemento por descarga: exibimos o rateio referencial por volume e por kg.
  const isDescarga =
    isComplemento && /DESCARG/i.test(cte.motivo_complemento ?? "");

  const podeAbrirOriginal = !!cteOriginal?.id;

  const openCteLink = (cteId: string) => {
    if (linkMode === "window") {
      openAppRoute(router, `/ctes/${cteId}`);
    } else if (linkMode === "dialog" && onOpenCte) {
      onOpenCte(cteId);
    } else {
      void router.navigate({ to: "/ctes/$cteId", params: { cteId } });
    }
  };


  const LinkOriginal = ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) =>
    podeAbrirOriginal ? (
      <button
        type="button"
        onClick={() => openCteLink(cteOriginal!.id)}
        title="Abrir detalhamento do CT-e original"
        className={`cursor-pointer underline underline-offset-2 hover:opacity-80 ${className ?? ""}`}
      >
        {children}
      </button>
    ) : (
      <span className={className}>{children}</span>
    );

  return (
    <div className="space-y-5">
      <div className="rounded-md border p-3">
        <div className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
          Tomador do serviço
        </div>
        {cte.tomador_cnpj || cte.tomador_nome ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="CNPJ/CPF" value={cte.tomador_cnpj ?? "—"} />
            <Field label="Razão social" value={cte.tomador_nome ?? "—"} />
            <Field
              label="Papel no CT-e"
              value={
                cte.tomador_papel
                  ? (PAPEL_LABEL[cte.tomador_papel] ?? cte.tomador_papel)
                  : "—"
              }
              hint={cte.empresa_id ? "Empresa cadastrada no app" : "Empresa não cadastrada no app"}
            />
          </div>
        ) : (
          <div className="text-muted-foreground text-sm">
            Tomador não identificado no XML. Use “Reprocessar tomadores” na listagem de CT-e.
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">

        <Field label="Transportadora" value={transportadoraNome ?? "Não identificada"} />
        <Field
          label="CNPJ emitente"
          value={cte.cnpj_emitente ?? "—"}
          hint={cte.nome_emitente ?? transportadoraNome ?? undefined}
        />
        <Field
          label="CNPJ destinatário"
          value={cte.cnpj_destinatario ?? "—"}
          hint={cte.nome_destinatario ?? nomeDestinatario ?? undefined}
        />

        <Field
          label="Emissão"
          value={cte.data_emissao ? new Date(cte.data_emissao).toLocaleString("pt-BR") : "—"}
        />
        <Field label="UF destino" value={cte.uf_destino ?? "—"} />
        <Field
          label="Origem da captura"
          value={cte.origem_captura === "MANUAL" ? "Manual" : "Automática (SEFAZ)"}
        />
        <Field
          label="Peso taxado"
          value={
            cte.peso_taxado == null
              ? "—"
              : `${Number(cte.peso_taxado).toLocaleString("pt-BR")} kg`
          }
        />
        <Field label="Valor da mercadoria" value={brl(Number(cte.valor_mercadoria))} />
        <Field label="Frete cobrado" value={brl(Number(cte.valor_total_frete))} />
        <Field
          label="% do frete"
          value={
            Number(cte.valor_mercadoria) > 0
              ? `${((Number(cte.valor_total_frete) / Number(cte.valor_mercadoria)) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
              : "—"
          }
        />
        <Field label="Recebido em" value={new Date(cte.created_at).toLocaleString("pt-BR")} />
        <Field label="Atualizado em" value={new Date(cte.updated_at).toLocaleString("pt-BR")} />
        <Field
          label="Tipo do CT-e"
          value={
            isReentrega
              ? "Reentrega"
              : isDevolucao
                ? "Devolução"

              : isComplementar
                ? "Complementar"
                : cte.tipo_cte === 2
                  ? "Anulação"
                  : cte.tipo_cte === 3
                    ? "Substituto"
                    : "Normal"
          }
          hint={isVinculado ? (cte.motivo_complemento ?? undefined) : undefined}
        />
        {isVinculado && (
          <Field
            label={isReentrega ? "Motivo" : "Motivo do complemento"}
            value={cte.motivo_complemento ?? "Não identificado"}
          />
        )}
        <Field label="Observação" value={cte.observacao ?? "—"} />
        <div className="col-span-2 sm:col-span-3">
          <Field
            label="Endereço de entrega"
            value={enderecoEntrega?.formatado ?? "—"}
            hint={
              enderecoEntrega?.pais && enderecoEntrega.pais.toUpperCase() !== "BRASIL"
                ? enderecoEntrega.pais
                : undefined
            }
          />
        </div>
      </div>

      {(isVinculado || (grupo?.length ?? 0) > 0) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {isVinculado ? (
            <>
              <strong>{isReentrega ? "CT-e de reentrega" : "CT-e complementar"}</strong>
              {cte.motivo_complemento ? ` — motivo: ${cte.motivo_complemento}` : ""}.
              Vinculado ao CT-e original{" "}
              {cte.numero_cte_complementado ? (
                <LinkOriginal className="font-semibold">
                  nº {cte.numero_cte_complementado}
                </LinkOriginal>
              ) : null}
              {grupo && grupo.length > 0 ? " (encontrado no app)" : " (ainda não importado)"}
              {cte.chave_cte_complementado ? (
                <>
                  {" "}
                  <LinkOriginal className="font-mono text-[11px] break-all">
                    {cte.chave_cte_complementado}
                  </LinkOriginal>
                </>
              ) : null}
              .{" "}
              {isReentrega
                ? "A auditoria considera apenas este CT-e."
                : "A auditoria é feita em conjunto com o original."}
            </>
          ) : (
            <>
              <strong>Possui {grupo!.length} cobrança(s) vinculada(s)</strong> (CT-e{" "}
              {grupo!
                .map((g) => `${g.numero ?? "s/nº"}${g.motivo_complemento ? ` – ${g.motivo_complemento}` : ""}`)
                .join(", ")}
              ). A auditoria soma o valor de todos eles.
            </>
          )}
        </div>
      )}

      {Array.isArray(cte.observacoes) && cte.observacoes.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Observações do CT-e</h3>
          <div className="rounded-md border">
            {(cte.observacoes as { campo?: string; texto?: string }[]).map((o, i) => (
              <div key={i} className="border-b px-3 py-2 text-sm last:border-b-0">
                <p className="text-muted-foreground text-xs">
                  {o.campo === "xObs" ? "Observação geral" : `Campo ${o.campo}`}
                </p>
                <p className="break-words">{o.texto}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Separator />

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Componentes do frete</h3>
        {componentes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhum componente informado.</p>
        ) : (
          <div className="rounded-md border">
            {componentes.map((c, i) => {
              const valor = Number(c.valor ?? 0);
              return (
                <div
                  key={`${c.nome}-${i}`}
                  className="flex items-start justify-between gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span>{isDescarga ? "DESCARGA" : c.nome || "—"}</span>
                  <div className="text-right">
                    <div className="font-medium">{brl(valor)}</div>
                    {isDescarga ? (
                      <div className="text-muted-foreground text-xs">
                        {volumesExibidos > 0
                          ? `${brl(valor)} ÷ ${volumesExibidos.toLocaleString("pt-BR")} volumes = ${brl(valor / volumesExibidos)}/volume`
                          : "volumes não disponíveis"}
                        <br />
                        {pesoExibido > 0
                          ? `${brl(valor)} ÷ ${pesoExibido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg = ${brl(valor / pesoExibido)}/kg`
                          : "peso não disponível"}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <div className="bg-muted/40 flex items-center justify-between px-3 py-2 text-sm font-semibold">
              <span>Total</span>
              <span>{brl(Number(cte.valor_total_frete))}</span>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Notas fiscais referenciadas</h3>
          {usandoNfsDoOriginal ? (
            <Badge
              variant="outline"
              className="border-amber-300 bg-amber-50 text-[10px] text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
            >
              Do CT-e original{" "}
              {cteOriginal?.numero ? <LinkOriginal>nº {cteOriginal.numero}</LinkOriginal> : ""}
            </Badge>
          ) : null}
        </div>
        {usandoNfsDoOriginal ? (
          <p className="text-muted-foreground text-xs">
            Este CT-e é complementar e não possui NF-e própria; as notas abaixo são as referenciadas
            no CT-e original.
          </p>
        ) : null}
        {nfs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma NF-e vinculada.</p>
        ) : (
          <div
            className={
              usandoNfsDoOriginal
                ? "space-y-2 rounded-md border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/30"
                : "space-y-2"
            }
          >
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-[11px] table-fixed">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium w-[180px]">Chave</th>
                    <th className="px-2 py-1.5 text-left font-medium w-[60px]">Nº</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Volumes</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Peso bruto (kg)</th>
                    <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Borderô</th>
                    <th className="px-2 py-1.5 text-left font-medium whitespace-nowrap">Dt. saída</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Frete</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Perna</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Diária</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Pernoite</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Reentrega</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Descarrego</th>
                    <th className="px-2 py-1.5 text-right font-medium whitespace-nowrap">Frete contabilizado</th>
                  </tr>
                </thead>
                <tbody>
                  {nfs.map((nf) => {
                    const info = volumesMap.get(nf.replace(/\D/g, ""));
                    return (
                      <tr key={nf} className="border-t">
                        <td className="px-2 py-1.5 font-mono break-all">
                          {/^\d{44}$/.test(nf) ? (
                            <Link
                              to="/nfes/$chave"
                              params={{ chave: nf }}
                              target={linkMode === "window" ? appLinkTarget() : undefined}
                              rel={
                                linkMode === "window" && appLinkTarget()
                                  ? "noopener noreferrer"
                                  : undefined
                              }
                              className="underline underline-offset-2 hover:opacity-80"
                            >
                              {nf.replace(/(.{4})(?!$)/g, "$1 ")}
                            </Link>
                          ) : (
                            nf.replace(/(.{4})(?!$)/g, "$1 ")
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">{info?.numero ?? "—"}</td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {info?.volumes != null ? (
                            info.volumes.toLocaleString("pt-BR")
                          ) : cargaNaLinha?.volumes != null ? (
                            <span title="Valor declarado na carga do CT-e" className="whitespace-nowrap">
                              {cargaNaLinha.volumes.toLocaleString("pt-BR")}
                              <span className="text-muted-foreground ml-1 text-[10px]">(CT-e)</span>
                            </span>
                          ) : (
                            statusLabel(info?.status, volumesLoading, info?.mensagem)
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right whitespace-nowrap">
                          {info?.peso_bruto != null ? (
                            info.peso_bruto.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          ) : cargaNaLinha?.peso_real != null ? (
                            <span title="Peso declarado na carga do CT-e" className="whitespace-nowrap">
                              {cargaNaLinha.peso_real.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                              <span className="text-muted-foreground ml-1 text-[10px]">(CT-e)</span>
                            </span>
                          ) : (
                            statusLabel(info?.status, volumesLoading, info?.mensagem)
                          )}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {(fretesPorChave.get(nf.replace(/\D/g, "")) ?? [])
                            .map((f) => f.bordero ?? "—")
                            .join(", ") || "—"}
                        </td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          {(() => {
                            const lancados = fretesPorChave.get(nf.replace(/\D/g, "")) ?? [];
                            if (lancados.length === 0) return "—";
                            return lancados.map((f, idx) => (
                              <span key={idx} className="inline-block align-top">
                                {dataHoraCelula(f.dt_saida)}
                                {idx < lancados.length - 1 ? (
                                  <span className="text-muted-foreground mx-1">,</span>
                                ) : null}
                              </span>
                            ));
                          })()}
                        </td>
                        {(
                          [
                            "vlr_frete",
                            "vlr_perna",
                            "vlr_diaria",
                            "vlr_pernoite",
                            "vlr_reentrega",
                            "vlr_descarrego",
                          ] as const
                        ).map((campo) => {
                          const lancados = fretesPorChave.get(nf.replace(/\D/g, "")) ?? [];
                          const soma = lancados.reduce((s, f) => s + Number(f[campo] ?? 0), 0);
                          return (
                            <td key={campo} className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                              {lancados.length === 0 ? "—" : brl(soma)}
                            </td>
                          );
                        })}
                        <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {(() => {
                            const lancados = fretesPorChave.get(nf.replace(/\D/g, "")) ?? [];
                            if (lancados.length === 0) return "—";
                            const total = lancados.reduce((s, f) => s + f.total, 0);
                            const detalhe = lancados
                              .flatMap((f) =>
                                [
                                  ["Frete", f.vlr_frete],
                                  ["Perna", f.vlr_perna],
                                  ["Diária", f.vlr_diaria],
                                  ["Pernoite", f.vlr_pernoite],
                                  ["Reentrega", f.vlr_reentrega],
                                  ["Descarrego", f.vlr_descarrego],
                                ].filter(([, v]) => Number(v) > 0),
                              )
                              .map(([nome, v]) => `${nome}: ${brl(Number(v))}`)
                              .join(" | ");
                            return (
                              <span title={detalhe || undefined} className="font-medium">
                                {brl(total)}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t font-semibold">
                    <td className="px-2 py-1.5" colSpan={2}>
                      Total ({nfs.length} nota{nfs.length === 1 ? "" : "s"})
                      {usandoCargaDoCte ? (
                        <span className="text-muted-foreground ml-1 font-normal">
                          — dados do CT-e
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                      {volumesExibidos.toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                      {pesoExibido.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-2 py-1.5" colSpan={2} />
                    {(
                      [
                        "vlr_frete",
                        "vlr_perna",
                        "vlr_diaria",
                        "vlr_pernoite",
                        "vlr_reentrega",
                        "vlr_descarrego",
                      ] as const
                    ).map((campo) => {
                      const soma = ((fretesErp?.itens ?? []) as FreteContabilizadoNfe[]).reduce(
                        (s, f) => s + Number(f[campo] ?? 0),
                        0,
                      );
                      return (
                        <td key={campo} className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                          {soma > 0 ? brl(soma) : "—"}
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                      {totalFreteErp > 0 ? brl(totalFreteErp) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {usandoCargaDoCte && carga ? (
              <div className="text-muted-foreground rounded-md border border-dashed p-2 text-xs">
                <p>
                  Os XMLs das NF-es ainda não foram capturados na SEFAZ. Enquanto isso, os totais
                  acima vêm da carga declarada no próprio CT-e.
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {carga.produto_predominante ? (
                    <span>Produto predominante: {carga.produto_predominante}</span>
                  ) : null}
                  {carga.valor_carga > 0 ? <span>Valor da carga: {brl(carga.valor_carga)}</span> : null}
                  {carga.medidas
                    .filter((m) => m.quantidade > 0)
                    .map((m) => (
                      <span key={m.tipo}>
                        {m.tipo}: {m.quantidade.toLocaleString("pt-BR")}
                      </span>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      {/* Reentrega é um serviço próprio: audita normalmente. Só o complementar não audita. */}
      {!isComplemento || isReentrega ? (
        <>
      <Separator />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Auditoria da cobrança</h3>
          <Button size="sm" disabled={audit.isPending} onClick={() => audit.mutate(cte.id)}>
            {audit.isPending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <ScanSearch className="mr-1 h-4 w-4" />
            )}
            Auditar cobrança
          </Button>
        </div>

        {!ultimaAuditoria ? (
          <p className="text-muted-foreground text-sm">
            Nenhuma auditoria executada. Compare a cobrança com a tabela de frete da transportadora
            emissora.
          </p>
        ) : (
          <div
            className={`rounded-md border p-3 ${
              ultimaAuditoria.resultado === "OK"
                ? "border-emerald-500/40 bg-emerald-500/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {ultimaAuditoria.resultado === "OK" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="text-destructive h-4 w-4" />
              )}
              <span
                className={`text-sm font-semibold ${
                  ultimaAuditoria.resultado === "OK" ? "text-emerald-600" : "text-destructive"
                }`}
              >
                {ultimaAuditoria.resultado === "OK"
                  ? "OK — cobrança confere com a tabela"
                  : "DIVERGENTE"}
              </span>
              <span className="text-muted-foreground ml-auto text-xs">
                {new Date(ultimaAuditoria.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Esperado {brl(Number(ultimaAuditoria.valor_esperado_total))} · Cobrado{" "}
              {brl(Number(ultimaAuditoria.valor_cobrado_total))} · Diferença{" "}
              {brl(Number(ultimaAuditoria.diferenca))} (
              {Number(ultimaAuditoria.percentual_diferenca).toFixed(2)}%)
            </div>
            <div className="text-muted-foreground mt-1 text-xs">
              Tabela de frete utilizada:{" "}
              {ultimaAuditoria.tabela_preco_id ? (
                <>
                  <Link
                    to="/tabelas-frete"
                    search={{ tabela: ultimaAuditoria.tabela_preco_id }}
                    target={appLinkTarget()}
                    className="text-primary font-medium underline underline-offset-2"
                  >
                    {tabelaUsada?.nome ?? "abrir tabela"}
                  </Link>
                  {tabelaUsada ? (
                    <span>
                      {" "}
                      · vigência {new Date(`${tabelaUsada.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                      {tabelaUsada.data_fim
                        ? ` a ${new Date(`${tabelaUsada.data_fim}T00:00:00`).toLocaleDateString("pt-BR")}`
                        : " (sem término)"}
                      {tabelaUsada.uf_destino ? ` · UF ${tabelaUsada.uf_destino}` : ""}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-amber-600">
                  nenhuma tabela vigente encontrada para a transportadora
                </span>
              )}
            </div>

            <div className="mt-2">
              <PracaOverrideDialog cteId={cte.id} onSaved={() => qc.invalidateQueries({ queryKey: ["cte-auditorias", cte.id] })} />
            </div>

            {(() => {
              const linhas = (
                Array.isArray(ultimaAuditoria.detalhamento)
                  ? (ultimaAuditoria.detalhamento as unknown as {
                      nome?: string;
                      esperado?: number;
                      cobrado?: number | null;
                      criterio?: string | null;
                    }[])
                  : []
              ).map((d) => ({
                nome: d.nome ?? "—",
                esperado: Number(d.esperado ?? 0),
                cobrado: d.cobrado == null ? null : Number(d.cobrado),
                criterio: d.criterio ?? null,
              }));
              if (linhas.length === 0) return null;

              const somaEsperado = linhas.reduce((s, l) => s + l.esperado, 0);
              const somaCobrado = linhas.reduce((s, l) => s + (l.cobrado ?? 0), 0);
              const totalCte = Number(cte.valor_total_frete);
              const naoConciliado = Math.round((totalCte - somaCobrado) * 100) / 100;

              return (
                <div className="bg-background mt-3 overflow-hidden rounded-md border">
                  <div className="text-muted-foreground grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-b px-3 py-1.5 text-[11px] font-medium">
                    <span>Componente</span>
                    <span className="text-right">Esperado (tabela)</span>
                    <span className="text-right">Cobrado (CT-e)</span>
                    <span className="text-right">Diferença</span>
                  </div>
                  {linhas.map((l, i) => {
                    const diff = (l.cobrado ?? 0) - l.esperado;
                    const semTabela = l.esperado === 0 && l.cobrado != null;
                    const naoCobrado = l.cobrado == null;
                    return (
                      <div
                        key={`${l.nome}-${i}`}
                        className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 border-b px-3 py-1.5 text-xs last:border-b-0"
                      >
                        <span className="flex flex-wrap items-center gap-1.5">
                          {l.nome}
                          {semTabela ? (
                            <Badge
                              variant="outline"
                              className="border-amber-500/40 text-[9px] text-amber-600"
                            >
                              fora da tabela
                            </Badge>
                          ) : null}
                          {naoCobrado ? (
                            <Badge
                              variant="outline"
                              className="text-muted-foreground text-[9px]"
                            >
                              não cobrado
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-right">
                          <span className="tabular-nums">{brl(l.esperado)}</span>
                          {l.criterio ? (
                            <span className="text-muted-foreground block text-[10px] leading-tight font-normal">
                              {l.criterio}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-right tabular-nums">
                          {l.cobrado == null ? "—" : brl(l.cobrado)}
                        </span>
                        <span
                          className={`text-right font-medium tabular-nums ${
                            Math.abs(diff) < 0.01
                              ? "text-emerald-600"
                              : diff > 0
                                ? "text-destructive"
                                : "text-emerald-600"
                          }`}
                        >
                          {Math.abs(diff) < 0.01 ? brl(0) : brl(diff)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="bg-muted/40 grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-t px-3 py-2 text-xs font-semibold">
                    <span>Total</span>
                    <span className="text-right tabular-nums">{brl(somaEsperado)}</span>
                    <span className="text-right tabular-nums">{brl(somaCobrado)}</span>
                    <span
                      className={`text-right tabular-nums ${
                        Math.abs(somaCobrado - somaEsperado) < 0.01
                          ? "text-emerald-600"
                          : somaCobrado - somaEsperado > 0
                            ? "text-destructive"
                            : "text-emerald-600"
                      }`}
                    >
                      {brl(somaCobrado - somaEsperado)}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </section>

        </>
      ) : null}
      <CteAprovacaoPanel cteId={cte.id} />

      <div className="flex justify-end gap-2">

        <Button variant="outline" disabled={!cte.xml_storage_path} onClick={() => onReadXml(cte)}>
          <FileCode className="mr-1 h-4 w-4" />
          Ler XML
        </Button>
        <Button
          variant="outline"
          disabled={!cte.xml_storage_path || downloading}
          onClick={() => onDownloadXml(cte)}
        >
          {downloading ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <FileDown className="mr-1 h-4 w-4" />
          )}
          Baixar XML
        </Button>
      </div>
    </div>
  );
}
