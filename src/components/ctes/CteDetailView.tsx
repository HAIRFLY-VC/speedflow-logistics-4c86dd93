import { AlertTriangle, CheckCircle2, FileCode, FileDown, Loader2, ScanSearch } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useRouter } from "@tanstack/react-router";
import { openAppRoute, appLinkTarget } from "@/lib/open-in-tab";

import { toast } from "sonner";

import { auditarCte } from "@/lib/cte-audit.functions";
import { obterEnderecoEntregaCte, resolverNomeDestinatario } from "@/lib/cte-backfill.functions";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/central/client";
import type { Tables } from "@/integrations/supabase/types";

type Cte = Tables<"ctes">;

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const { data: historico, isLoading: loadingHist } = useQuery({

    queryKey: ["cte-historico", cte.id],
    enabled: !!cte.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cte_status_historico")
        .select("*")
        .eq("cte_id", cte.id)
        .order("alterado_em", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const { data: divergencias } = useQuery({
    queryKey: ["cte-divergencias", cte.id],
    enabled: !!cte.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cte_divergencias")
        .select("*")
        .eq("cte_id", cte.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const isComplementar = cte.tipo_cte === 1 || !(Number(cte.peso_taxado) > 0);
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
        "id, numero, chave_acesso, valor_total_frete, motivo_complemento, nfs_referenciadas";
      let q;
      if (cte.chave_cte_complementado) {
        q = supabase
          .from("ctes")
          .select(cols)
          .eq("chave_acesso", cte.chave_cte_complementado);
      } else if (isComplementar && cte.numero_cte_complementado && cte.cnpj_emitente) {
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
      return (data ?? []).filter((g) => g.id !== cte.id);
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
      qc.invalidateQueries({ queryKey: ["cte-divergencias", cte.id] });
      qc.invalidateQueries({ queryKey: ["cte-historico", cte.id] });
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
  const divergenciasAbertas = (divergencias ?? []).filter((d) => d.status !== "RESOLVIDA");

  const componentes = (Array.isArray(cte.componentes) ? cte.componentes : []) as {
    nome?: string;
    valor?: number;
  }[];
  const nfsProprias = (Array.isArray(cte.nfs_referenciadas) ? cte.nfs_referenciadas : []) as string[];
  const cteOriginal = isComplementar ? (grupo?.[0] ?? null) : null;
  const nfsDoOriginal = (
    Array.isArray(cteOriginal?.nfs_referenciadas) ? cteOriginal!.nfs_referenciadas : []
  ) as string[];
  const usandoNfsDoOriginal = nfsProprias.length === 0 && nfsDoOriginal.length > 0;
  const nfs = usandoNfsDoOriginal ? nfsDoOriginal : nfsProprias;

  const podeAbrirOriginal = !!cteOriginal?.id && (linkMode !== "same" || !!onOpenCte);

  const openCteLink = (cteId: string) => {
    if (linkMode === "window") {
      openAppRoute(router, `/ctes/${cteId}`);
    } else if (linkMode === "dialog") {
      onOpenCte?.(cteId);
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
            isComplementar
              ? "Complementar"
              : cte.tipo_cte === 2
                ? "Anulação"
                : cte.tipo_cte === 3
                  ? "Substituto"
                  : "Normal"
          }
          hint={isComplementar ? (cte.motivo_complemento ?? undefined) : undefined}
        />
        {isComplementar && (
          <Field
            label="Motivo do complemento"
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

      {(isComplementar || (grupo?.length ?? 0) > 0) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {isComplementar ? (
            <>
              <strong>CT-e complementar</strong>
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
              . A auditoria é feita em conjunto com o original.
            </>
          ) : (
            <>
              <strong>Possui {grupo!.length} complemento(s) de frete</strong> (CT-e{" "}
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
            {componentes.map((c, i) => (
              <div
                key={`${c.nome}-${i}`}
                className="flex items-center justify-between border-b px-3 py-2 text-sm last:border-b-0"
              >
                <span>{c.nome || "—"}</span>
                <span className="font-medium">{brl(Number(c.valor ?? 0))}</span>
              </div>
            ))}
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
                ? "flex flex-wrap gap-1.5 rounded-md border border-amber-200 bg-amber-50/50 p-2 dark:border-amber-900 dark:bg-amber-950/30"
                : "flex flex-wrap gap-1.5"
            }
          >
            {nfs.map((nf) =>
              /^\d{44}$/.test(nf) ? (
                <Link
                  key={nf}
                  to="/nfes/$chave"
                  params={{ chave: nf }}
                  target={linkMode === "window" ? appLinkTarget() : undefined}
                  rel={
                    linkMode === "window" && appLinkTarget()
                      ? "noopener noreferrer"
                      : undefined
                  }

                >
                  <Badge
                    variant="outline"
                    className="hover:bg-muted cursor-pointer font-mono text-[10px]"
                  >
                    {nf}
                  </Badge>
                </Link>
              ) : (
                <Badge key={nf} variant="outline" className="font-mono text-[10px]">
                  {nf}
                </Badge>
              ),
            )}
          </div>
        )}
      </section>

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

            {(() => {
              const linhas = (
                Array.isArray(ultimaAuditoria.detalhamento)
                  ? (ultimaAuditoria.detalhamento as unknown as {
                      nome?: string;
                      esperado?: number;
                      cobrado?: number | null;
                    }[])
                  : []
              ).map((d) => ({
                nome: d.nome ?? "—",
                esperado: Number(d.esperado ?? 0),
                cobrado: d.cobrado == null ? null : Number(d.cobrado),
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
                        <span className="text-right tabular-nums">{brl(l.esperado)}</span>
                        <span className="text-right tabular-nums">
                          {l.cobrado == null ? "—" : brl(l.cobrado)}
                        </span>
                        <span
                          className={`text-right font-medium tabular-nums ${
                            Math.abs(diff) < 0.01 ? "text-emerald-600" : "text-destructive"
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
                          : "text-destructive"
                      }`}
                    >
                      {brl(somaCobrado - somaEsperado)}
                    </span>
                  </div>
                  <div className="text-muted-foreground grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2 border-t px-3 py-1.5 text-[11px]">
                    <span>Total do CT-e</span>
                    <span />
                    <span className="text-right tabular-nums">{brl(totalCte)}</span>
                    <span
                      className={`text-right tabular-nums ${
                        Math.abs(naoConciliado) < 0.01 ? "" : "text-amber-600"
                      }`}
                    >
                      {Math.abs(naoConciliado) < 0.01
                        ? "conciliado"
                        : `${brl(naoConciliado)} não conciliado`}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {divergenciasAbertas.length > 0 ? (
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium">Divergências em aberto</h4>
            <div className="rounded-md border">
              {divergenciasAbertas.map((d) => (
                <div key={d.id} className="border-b px-3 py-2 text-sm last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-destructive">{d.motivo}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {d.status.replaceAll("_", " ")}
                    </Badge>
                  </div>
                  {d.observacao_operador ? (
                    <div className="text-muted-foreground mt-1 text-xs">
                      {d.observacao_operador}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {auditorias && auditorias.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Histórico de auditorias</h3>
          <div className="rounded-md border">
            {auditorias.map((a) => (
              <div key={a.id} className="border-b px-3 py-2 text-sm last:border-b-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      a.resultado === "OK"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive"
                    }
                  >
                    {a.resultado}
                  </Badge>
                  <span className="text-muted-foreground text-xs">
                    {new Date(a.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  Esperado {brl(Number(a.valor_esperado_total))} · Cobrado{" "}
                  {brl(Number(a.valor_cobrado_total))} · Diferença{" "}
                  {brl(Number(a.diferenca))} ({Number(a.percentual_diferenca).toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Histórico de status</h3>
        {loadingHist ? (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        ) : !historico?.length ? (
          <p className="text-muted-foreground text-sm">Sem histórico.</p>
        ) : (
          <ol className="space-y-1.5">
            {historico.map((h) => (
              <li key={h.id} className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {new Date(h.alterado_em).toLocaleString("pt-BR")}
                </span>
                <span>
                  {h.status_anterior ? `${h.status_anterior.replaceAll("_", " ")} → ` : ""}
                  <span className="font-medium">{h.status_novo.replaceAll("_", " ")}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

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
