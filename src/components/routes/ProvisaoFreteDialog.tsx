import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, ChevronRight, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { supabase } from "@/integrations/central/client";
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
import { Button } from "@/components/ui/button";
import { PracaBusca } from "./PracaBusca";
import { definirPracaMunicipio } from "@/lib/frete-area.functions";
import { gravarProvisaoFrete, previewProvisaoFrete } from "@/lib/provisao-frete.functions";
import type { DetalheFrete } from "@/lib/frete-simulacao";
import { chaveNota, type ProvisaoEntrega } from "@/lib/provisao-frete.types";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const kg = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
const pct = (f: number | null, m: number) =>
  f == null || m <= 0
    ? "—"
    : `${((f / m) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function Composicao({ det, mercadoria }: { det: DetalheFrete; mercadoria: number }) {
  const linhas: [string, string, number | null][] = [];
  if (det.metodo === "praca") {
    linhas.push(["Praça da tabela", det.praca ?? "—", null]);
    linhas.push([
      "Frete peso",
      `${kg(det.peso_cobrado)} kg cobrados${det.peso_cobrado > det.peso_real ? ` (mínimo ${kg(det.peso_minimo)} kg; real ${kg(det.peso_real)} kg)` : ""} × ${brl(det.tarifa_kg)}/kg`,
      det.frete_peso,
    ]);
    linhas.push(["Frete valor", `${num(det.frete_valor_perc)}% × ${brl(mercadoria)}`, det.frete_valor]);
  } else if (det.metodo === "faixa_peso") {
    linhas.push(["Faixa de peso", det.faixa ?? "—", null]);
    linhas.push(["Valor fixo da faixa", "", det.valor_fixo_faixa]);
    linhas.push(["Frete peso", `${kg(det.peso_real)} kg × ${brl(det.tarifa_kg)}/kg`, det.frete_peso]);
  } else {
    linhas.push(["Frete valor", `${num(det.frete_valor_perc)}% × ${brl(mercadoria)}`, det.frete_valor]);
  }
  linhas.push(["= Frete calculado", "", det.base_calculada]);
  if (det.frete_minimo > 0)
    linhas.push([
      "Frete mínimo",
      det.minimo_aplicado ? `aplicado (${brl(det.frete_minimo)})` : `não aplicado (${brl(det.frete_minimo)})`,
      det.minimo_aplicado ? det.frete_minimo : null,
    ]);
  if (det.taxa_despacho > 0) linhas.push(["Taxa de despacho", "", det.taxa_despacho]);
  linhas.push(["= Frete base", "", det.frete_base]);
  linhas.push([
    "GRIS",
    `${num(det.gris_perc)}% × ${brl(mercadoria)}${det.gris_minimo_aplicado ? ` (mínimo ${brl(det.gris_minimo)} aplicado)` : ""}`,
    det.gris,
  ]);
  linhas.push(["Ad valorem", `${num(det.ad_valorem_perc)}% × ${brl(mercadoria)}`, det.ad_valorem]);
  linhas.push(["TAS", "", det.tas]);
  linhas.push(["= Subtotal", "", det.subtotal]);
  linhas.push(["ICMS (por dentro)", `subtotal ÷ (1 − ${num(det.icms_perc)}%)`, det.icms]);
  linhas.push(["= Total da entrega", `${pct(det.total, mercadoria)} da mercadoria`, det.total]);
  return (
    <table className="w-full max-w-2xl text-[11px]">
      <tbody>
        {linhas.map(([l, f, v], i) => (
          <tr key={i} className={l.startsWith("=") ? "border-t font-semibold" : ""}>
            <td className="py-0.5 pr-2">{l.replace(/^= /, "")}</td>
            <td className="py-0.5 pr-2 text-muted-foreground">{f}</td>
            <td className="py-0.5 text-right tabular-nums">{v == null ? "" : brl(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ResumoComponentes({ entregas }: { entregas: ProvisaoEntrega[] }) {
  const ds = entregas.map((e) => e.detalhe).filter((x): x is DetalheFrete => !!x);
  if (ds.length === 0) return null;
  const s = (k: keyof DetalheFrete) => ds.reduce((a, d) => a + Number(d[k] || 0), 0);
  const itens: [string, number][] = [
    ["Frete base", s("frete_base")],
    ["GRIS", s("gris")],
    ["Ad valorem", s("ad_valorem")],
    ["TAS", s("tas")],
    ["ICMS", s("icms")],
  ];
  return (
    <div className="flex flex-wrap gap-2 text-[11px]">
      {itens.map(([l, v]) => (
        <span key={l} className="rounded border border-border px-2 py-0.5">
          {l}: <strong className="tabular-nums">{brl(v)}</strong>
        </span>
      ))}
    </div>
  );
}

export function ProvisaoFreteDialog(props: {
  routeId: string | null;
  rotulo: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewProvisaoFrete);
  const gravar = useServerFn(gravarProvisaoFrete);

  const q = useQuery({
    queryKey: ["provisao-frete", props.routeId],
    enabled: props.open && !!props.routeId,
    queryFn: () => preview({ data: { routeId: props.routeId! } }),
    retry: false,
  });

  const [tabelaSel, setTabelaSel] = useState<string>("");
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const d = q.data;
  // Oferece o vínculo quando a transportadora foi identificada mas não tem
  // tabela de frete vigente.
  const semTabela = !!d?.transportadora && !d?.tabela;
  const hojeIso = new Date().toISOString().slice(0, 10);
  const vencida = (fim: string | null) => !!fim && fim < hojeIso;

  const tabelasQ = useQuery({
    queryKey: ["provisao-frete", "tabelas-ativas"],
    enabled: props.open && semTabela,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("id, nome, data_inicio, data_fim")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; data_inicio: string; data_fim: string | null }[];
    },
  });

  const vincular = useMutation({
    mutationFn: async () => {
      if (!tabelaSel) throw new Error("Selecione a tabela de frete");
      const { error } = await supabase
        .from("tabelas_preco_frete_transportadoras")
        .insert({ tabela_id: tabelaSel, transportadora_id: d!.transportadora!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tabela vinculada à transportadora. Recalculando…");
      setTabelaSel("");
      qc.invalidateQueries({ queryKey: ["provisao-frete"] });
      qc.invalidateQueries({ queryKey: ["tabelas-frete-vinculos"] });
      qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const definirPraca = useServerFn(definirPracaMunicipio);
  const praca = useMutation({
    mutationFn: (v: { rotaId: string; municipio: string }) => definirPraca({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(`Praça definida para ${v.municipio}. Recalculando…`);
      qc.invalidateQueries({ queryKey: ["provisao-frete"] });
      qc.invalidateQueries({ queryKey: ["tabelas-frete"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const seletorPraca = (cidade: string | null, atual: string | null) =>
    cidade && d && d.pracas.length > 0 ? (
      <div onClick={(ev) => ev.stopPropagation()} className="inline-block">
        <PracaBusca
          cidade={cidade}
          atual={d.pracas.find((p) => p.id === atual)?.destino ?? null}
          pracas={d.pracas}
          disabled={praca.isPending}
          onSelect={(id) => praca.mutate({ rotaId: id, municipio: cidade })}
        />
      </div>
    ) : null;

  const m = useMutation({
    mutationFn: (substituir: boolean) => gravar({ data: { routeId: props.routeId!, substituir } }),
    onSuccess: (r) => {
      toast.success(`Provisionamento gravado no ERP: ${brl(r.total)} em ${r.linhas} nota(s).`);
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["provisao-frete"] });
      props.onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const g = d?.gravado ?? null;
  const vGravado = (n: Parameters<typeof chaveNota>[0]) => g?.por_nota[chaveNota(n)];
  const vGravadoEntrega = (e: ProvisaoEntrega) =>
    g ? e.notas.reduce((s, n) => s + (vGravado(n) ?? 0), 0) : undefined;
  const cGrav = (v: number | undefined, atual: number | null) => (
    <td
      className={`p-1 text-right tabular-nums ${
        v != null && atual != null && Math.abs(v - atual) > 0.009 ? "font-semibold text-destructive" : ""
      }`}
    >
      {v == null ? "—" : brl(v)}
    </td>
  );

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Provisionar frete da transportadora</DialogTitle>
          <DialogDescription>
            Rota {props.rotulo}
            {d?.transportadora ? ` · ${d.transportadora.razao_social}` : ""}
            {d?.tabela ? ` · tabela "${d.tabela.nome}"` : ""}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando pela tabela de frete…
          </div>
        )}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}

        {d && (
          <div className="space-y-3">
            {g && (
              <p className="rounded-md border border-border bg-muted p-2 text-xs">
                Provisionamento gravado no ERP: <strong>{brl(g.total)}</strong>
                {g.dt_provisao ? ` em ${new Date(g.dt_provisao).toLocaleString("pt-BR")}` : ""}
                {g.usuario ? ` por ${g.usuario}` : ""}. A coluna "Calculado" mostra o cálculo pela
                tabela de frete atual.
              </p>
            )}
            {g && d.divergente && (
              <div className="flex items-center gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> Provisionamento gravado diverge do cálculo atual
                (gravado {brl(g.total)} × atual {brl(d.total)}).
              </div>
            )}
            {d.bloqueios.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
                {d.bloqueios.map((b) => (
                  <div key={b} className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {b}
                  </div>
                ))}
              </div>
            )}
            {semTabela && (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">
                  A transportadora <strong>{d.transportadora!.razao_social}</strong> não tem tabela
                  de frete vigente. Selecione uma tabela existente para vinculá-la e calcular o
                  provisionamento.
                </p>
                <div className="flex items-center gap-2">
                  <Select value={tabelaSel} onValueChange={setTabelaSel}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue
                        placeholder={
                          tabelasQ.isLoading ? "Carregando tabelas…" : "Selecione a tabela de frete"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(tabelasQ.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.nome} · desde{" "}
                          {new Date(`${t.data_inicio}T00:00:00`).toLocaleDateString("pt-BR")}
                          {t.data_fim
                            ? ` até ${new Date(`${t.data_fim}T00:00:00`).toLocaleDateString("pt-BR")}`
                            : ""}
                          {vencida(t.data_fim) && (
                            <span className="ml-2 rounded bg-destructive/10 px-1 text-[10px] font-semibold text-destructive">
                              vencida
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!tabelaSel || vincular.isPending}
                    onClick={() => vincular.mutate()}
                  >
                    {vincular.isPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-1 h-4 w-4" />
                    )}
                    Vincular tabela
                  </Button>
                </div>
                {vencida(tabelasQ.data?.find((t) => t.id === tabelaSel)?.data_fim ?? null) && (
                  <p className="text-xs text-destructive">
                    Esta tabela está vencida. Mesmo vinculada, ela não será usada (e as praças não
                    aparecerão) até que a data final da vigência seja estendida ou removida.
                  </p>
                )}
                <a
                  href="/tabelas-frete"
                  className="inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
                >
                  Editar tabela de frete
                </a>
              </div>
            )}
            <div className="max-h-[55vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background text-muted-foreground">
                  <tr className="border-b text-left">
                    <th className="p-1 w-6"></th>
                    <th className="p-1">Filial</th>
                    <th className="p-1">NF</th>
                    <th className="p-1">Borderô</th>
                    <th className="p-1 text-right">Peso (kg)</th>
                    <th className="p-1 text-right">Mercadoria</th>
                    {g && <th className="p-1 text-right">Gravado</th>}
                    <th className="p-1 text-right">{g ? "Calculado" : "Frete"}</th>
                    <th className="p-1 text-right">% Frete</th>
                  </tr>
                </thead>
                <tbody>
                  {d.entregas.map((e) => {
                    const open = abertas.has(e.chave);
                    return (
                      <Fragment key={e.chave}>
                        <tr
                          className="cursor-pointer border-b bg-muted/60 font-semibold hover:bg-muted"
                          onClick={() => toggle(e.chave)}
                        >
                          <td className="p-1">
                            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </td>
                          <td className="p-1" colSpan={3}>
                            {e.cliente} · {[e.cidade, e.uf].filter(Boolean).join("/") || "—"}
                            <span className="ml-1 font-normal text-muted-foreground">
                              ({e.notas.length} nota{e.notas.length > 1 ? "s" : ""})
                            </span>
                          </td>
                          <td className="p-1 text-right tabular-nums">{kg(e.peso)}</td>
                          <td className="p-1 text-right tabular-nums">{brl(e.valor_mercadoria)}</td>
                          {g && cGrav(vGravadoEntrega(e), e.vlr_frete)}
                          <td className="p-1 text-right tabular-nums">
                            {e.vlr_frete == null ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-destructive">
                                  {d.tabela ? "praça não encontrada" : "sem tabela vigente"}
                                </span>
                                {seletorPraca(e.cidade, null)}
                              </div>
                            ) : (
                              brl(e.vlr_frete)
                            )}
                          </td>
                          <td className="p-1 text-right tabular-nums">{pct(e.vlr_frete, e.valor_mercadoria)}</td>
                        </tr>
                        {open && e.detalhe && (
                          <tr className="border-b">
                            <td></td>
                            <td colSpan={g ? 8 : 7} className="p-2">
                              {e.detalhe.metodo === "praca" && (
                                <div className="mb-2 flex items-center gap-2 text-[11px]">
                                  <span className="text-muted-foreground">
                                    Praça de {e.cidade}
                                    {e.detalhe.praca_origem === "aprendido" ? " (escolhida pelo usuário)" : " (automática)"}:
                                  </span>
                                  {seletorPraca(e.cidade, e.detalhe.praca_id)}
                                </div>
                              )}
                              <Composicao det={e.detalhe} mercadoria={e.valor_mercadoria} />
                            </td>
                          </tr>
                        )}
                        {e.notas.map((n) => (
                          <tr key={`${n.cod_filial}-${n.nro_nf}-${n.bordero}`} className="border-b">
                            <td></td>
                            <td className="p-1">{n.cod_filial}</td>
                            <td className="p-1">{n.nro_nf ?? "—"}</td>
                            <td className="p-1">{n.bordero ?? "—"}</td>
                            <td className="p-1 text-right tabular-nums">{kg(n.peso)}</td>
                            <td className="p-1 text-right tabular-nums">{brl(n.valor_mercadoria)}</td>
                            {g && cGrav(vGravado(n), n.vlr_frete)}
                            <td className="p-1 text-right tabular-nums">
                              {n.vlr_frete == null ? "—" : brl(n.vlr_frete)}
                            </td>
                            <td className="p-1 text-right tabular-nums">{pct(n.vlr_frete, n.valor_mercadoria)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td className="p-1" colSpan={4}>Total provisionado</td>
                    <td className="p-1 text-right tabular-nums">
                      {kg(d.entregas.reduce((s, e) => s + e.peso, 0))}
                    </td>
                    <td className="p-1 text-right tabular-nums">{brl(d.total_mercadoria)}</td>
                    {g && cGrav(g.total, d.total)}
                    <td className="p-1 text-right tabular-nums">{brl(d.total)}</td>
                    <td className="p-1 text-right tabular-nums">{pct(d.total, d.total_mercadoria)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <ResumoComponentes entregas={d.entregas} />
            <p className="text-[11px] text-muted-foreground">
              O frete é calculado uma vez por entrega (cliente + cidade) e rateado entre as notas
              proporcionalmente ao peso. Clique na entrega para ver a composição.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Fechar
          </Button>
          {d && (
            <Button variant="secondary" disabled={q.isFetching} onClick={() => q.refetch()}>
              <RefreshCw className={`mr-1 h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
              Recalcular
            </Button>
          )}
          {d && !g && (
            <Button disabled={d.bloqueios.length > 0 || m.isPending} onClick={() => m.mutate(false)}>
              {m.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
              {m.isPending ? `Gravando ${d.notas.length} nota(s)…` : "Gravar provisionamento no ERP"}
            </Button>
          )}
          {d && g && d.divergente && (
            <Button
              variant="destructive"
              disabled={d.bloqueios.length > 0 || m.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `Substituir o provisionamento gravado (${brl(g.total)}) pelos novos valores (${brl(d.total)})?`,
                  )
                )
                  m.mutate(true);
              }}
            >
              {m.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
              Substituir pelos novos valores
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
