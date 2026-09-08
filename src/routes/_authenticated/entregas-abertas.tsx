import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  FilterX,
  Loader2,
  PackageSearch,
  Pencil,
  RotateCcw,
  Search,
  FileSpreadsheet,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { ColumnFilter, type OpcaoColuna } from "@/components/data-table/ColumnFilter";
import {
  combinaFiltro,
  contarFiltros,
  type ColunaTipo,
} from "@/components/data-table/column-filters";
import { useColumnFilterPrefs } from "@/components/data-table/useColumnFilterPrefs";
import { FilterViewsBar } from "@/components/data-table/FilterViewsBar";
import { exportarXlsx, nomeArquivoComData } from "@/components/data-table/export-xlsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/central/client";
import { useClientesErp } from "@/hooks/useClientesErp";
import { salvarAcaoEntrega } from "@/lib/entregas-abertas.functions";

export const Route = createFileRoute("/_authenticated/entregas-abertas")({
  component: EntregasAbertasPage,
  head: () => ({
    meta: [
      { title: "Entregas em aberto | Speedflow" },
      {
        name: "description",
        content:
          "Acompanhe as notas fiscais já expedidas e ainda não entregues, com filtros, prazos e ações.",
      },
      { property: "og:title", content: "Entregas em aberto | Speedflow" },
      {
        property: "og:description",
        content: "Painel das entregas expedidas e pendentes, com ação, responsável e prazo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type EntregaRow = {
  nro_nf: string;
  cod_pedido: string;
  cod_cliente: string | null;
  cod_vendedor: string | null;
  cod_filial: string | null;
  cod_agenda: string | null;
  dt_pedido: string | null;
  dt_fatur: string | null;
  dt_saida: string | null;
  entrega_agend: string | null;
  cod_transp_ent: string | null;
  tipo_transp_ent: string | null;
  placa_veiculo_ent: string | null;
  valor: number;
  peso: number;
};

type AcaoRow = {
  nro_nf: string;
  cod_pedido: string;
  acao: string | null;
  responsavel: string | null;
  prazo: string | null;
};

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const dataBr = (v: string | null) => (v ? v.split("-").reverse().join("/") : "—");

function diasDesde(v: string | null): number | null {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

function faixaIdade(dias: number | null): string {
  if (dias === null) return "Sem data";
  if (dias <= 2) return "0-2 dias";
  if (dias <= 5) return "3-5 dias";
  if (dias <= 10) return "6-10 dias";
  return "+10 dias";
}

const MODAL_LABEL: Record<string, string> = { F: "Fretista", T: "Transportadora", P: "Próprio" };

function EntregasAbertasPage() {
  const qc = useQueryClient();
  const { nomeCliente, cidadeCliente, ufCliente } = useClientesErp();
  const salvar = useServerFn(salvarAcaoEntrega);

  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({ acao: "", responsavel: "", prazo: "" });
  const [alturaGrid, setAlturaGrid] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const totalizadorRef = useRef<HTMLDivElement>(null);

  const {
    filtros,
    sort,
    setFiltro,
    aplicarConjunto,
    limparFiltros,
    setSort,
    restaurarPadrao,
    carregando,
  } =
    useColumnFilterPrefs("entregas-abertas", { id: "dt_saida", dir: "asc" });

  const entregasQ = useQuery({
    queryKey: ["entregas-abertas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas_abertas")
        .select(
          "nro_nf, cod_pedido, cod_cliente, cod_vendedor, cod_filial, cod_agenda, dt_pedido, dt_fatur, dt_saida, entrega_agend, cod_transp_ent, tipo_transp_ent, placa_veiculo_ent, valor, peso",
        )
        .order("dt_saida", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as unknown as EntregaRow[];
    },
  });

  const acoesQ = useQuery({
    queryKey: ["entregas-acoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas_acoes")
        .select("nro_nf, cod_pedido, acao, responsavel, prazo");
      if (error) throw error;
      return (data ?? []) as unknown as AcaoRow[];
    },
  });

  const responsaveisQ = useQuery({
    queryKey: ["erp-responsaveis-nomes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_responsaveis")
        .select("cod_erp, razao_social");
      if (error) throw error;
      return (data ?? []) as { cod_erp: string; razao_social: string | null }[];
    },
    staleTime: 30 * 60 * 1000,
  });

  const nomePorCodigo = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of responsaveisQ.data ?? []) {
      if (r.razao_social) m.set(String(r.cod_erp).trim(), r.razao_social.trim());
    }
    return m;
  }, [responsaveisQ.data]);

  const acaoPorChave = useMemo(() => {
    const m = new Map<string, AcaoRow>();
    for (const a of acoesQ.data ?? []) m.set(`${a.nro_nf}|${a.cod_pedido}`, a);
    return m;
  }, [acoesQ.data]);

  type Item = EntregaRow & {
    chave: string;
    cliente: string;
    cidade: string | null;
    uf: string | null;
    transportadora: string;
    rca: string;
    modal: string;
    dias: number | null;
    faixa: string;
    filial: string;
    acao: AcaoRow | undefined;
  };

  const itens: Item[] = useMemo(() => {
    return (entregasQ.data ?? []).map((e) => {
      const dias = diasDesde(e.dt_saida);
      const cod = e.cod_transp_ent ? String(e.cod_transp_ent).trim() : "";
      const rcaCod = e.cod_vendedor ? String(e.cod_vendedor).trim() : "";
      return {
        ...e,
        chave: `${e.nro_nf}|${e.cod_pedido}`,
        cliente: nomeCliente(e.cod_cliente),
        cidade: cidadeCliente(e.cod_cliente),
        uf: ufCliente(e.cod_cliente),
        transportadora: cod ? nomePorCodigo.get(cod) ?? `Cód. ${cod}` : "(vazio)",
        rca: rcaCod ? nomePorCodigo.get(rcaCod) ?? `RCA ${rcaCod}` : "(vazio)",
        modal: MODAL_LABEL[String(e.tipo_transp_ent ?? "").trim()] ?? "(vazio)",
        dias,
        faixa: faixaIdade(dias),
        filial: e.cod_filial ? String(e.cod_filial).trim() : "(vazio)",
        acao: acaoPorChave.get(`${e.nro_nf}|${e.cod_pedido}`),
      };
    });
  }, [entregasQ.data, nomeCliente, cidadeCliente, ufCliente, nomePorCodigo, acaoPorChave]);

  type Coluna = {
    id: string;
    header: string;
    tipo: ColunaTipo;
    valor: (i: Item) => string | number | null;
    cell: (i: Item) => React.ReactNode;
    align?: "right";
    className?: string;
  };

  const colunas: Coluna[] = useMemo(
    () => [
      {
        id: "nro_nf",
        header: "NF",
        tipo: "text",
        valor: (i) => i.nro_nf,
        cell: (i) => <span className="font-medium">{i.nro_nf}</span>,
      },
      { id: "cod_pedido", header: "Pedido", tipo: "text", valor: (i) => i.cod_pedido, cell: (i) => i.cod_pedido },
      {
        id: "cliente",
        header: "Cliente",
        tipo: "text",
        valor: (i) => i.cliente,
        className: "max-w-[220px]",
        cell: (i) => (
          <>
            <p className="truncate font-medium">{i.cliente}</p>
            {i.cod_cliente && (
              <p className="text-[10px] text-muted-foreground">cód. {i.cod_cliente}</p>
            )}
          </>
        ),
      },
      { id: "uf", header: "UF", tipo: "text", valor: (i) => i.uf, cell: (i) => i.uf ?? "—" },
      {
        id: "cidade",
        header: "Cidade",
        tipo: "text",
        valor: (i) => i.cidade,
        className: "max-w-[160px] truncate",
        cell: (i) => i.cidade ?? "—",
      },
      {
        id: "rca",
        header: "RCA",
        tipo: "text",
        valor: (i) => i.rca,
        className: "max-w-[160px] truncate",
        cell: (i) => i.rca,
      },
      {
        id: "transportadora",
        header: "Transportadora",
        tipo: "text",
        valor: (i) => i.transportadora,
        className: "max-w-[180px] truncate",
        cell: (i) => i.transportadora,
      },
      { id: "modal", header: "Modal", tipo: "text", valor: (i) => i.modal, cell: (i) => i.modal },
      {
        id: "filial",
        header: "Filial",
        tipo: "text",
        valor: (i) => i.filial,
        cell: (i) => i.filial,
      },
      {
        id: "dt_pedido",
        header: "Dt. pedido",
        tipo: "date",
        valor: (i) => i.dt_pedido,
        cell: (i) => dataBr(i.dt_pedido),
      },
      {
        id: "dt_fatur",
        header: "Dt. fatur.",
        tipo: "date",
        valor: (i) => i.dt_fatur,
        cell: (i) => dataBr(i.dt_fatur),
      },
      {
        id: "dt_saida",
        header: "Dt. saída",
        tipo: "date",
        valor: (i) => i.dt_saida,
        cell: (i) => dataBr(i.dt_saida),
      },
      {
        id: "dias",
        header: "Dias",
        tipo: "number",
        align: "right",
        valor: (i) => i.dias,
        cell: (i) => (
          <Badge
            variant={i.dias !== null && i.dias > 10 ? "destructive" : "secondary"}
            className="text-[10px]"
          >
            {i.dias === null ? "—" : `${i.dias}d`}
          </Badge>
        ),
      },
      { id: "faixa", header: "Faixa", tipo: "text", valor: (i) => i.faixa, cell: (i) => i.faixa },
      {
        id: "valor",
        header: "Valor",
        tipo: "number",
        align: "right",
        valor: (i) => Number(i.valor) || 0,
        cell: (i) => brl(Number(i.valor) || 0),
      },
      {
        id: "peso",
        header: "Peso",
        tipo: "number",
        align: "right",
        valor: (i) => Number(i.peso) || 0,
        cell: (i) => (Number(i.peso) || 0).toFixed(0),
      },
      {
        id: "agendada",
        header: "Agendada",
        tipo: "text",
        valor: (i) => (i.entrega_agend === "S" ? "Sim" : "Não"),
        cell: (i) =>
          i.entrega_agend === "S" ? <span className="text-primary">Sim</span> : "—",
      },
      {
        id: "acao",
        header: "Ação / Responsável / Prazo",
        tipo: "text",
        valor: (i) => i.acao?.acao ?? "",
        className: "min-w-[240px]",
        cell: (i) => (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              {i.acao?.acao ? (
                <p className="truncate">
                  {i.acao.acao}
                  {i.acao.responsavel ? ` · ${i.acao.responsavel}` : ""}
                  {i.acao.prazo ? ` · até ${dataBr(i.acao.prazo)}` : ""}
                </p>
              ) : (
                <p className="text-muted-foreground">Sem ação</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 shrink-0 gap-1 px-2 text-xs"
              onClick={() => {
                setEditando(i.chave);
                setForm({
                  acao: i.acao?.acao ?? "",
                  responsavel: i.acao?.responsavel ?? "",
                  prazo: i.acao?.prazo ?? "",
                });
              }}
            >
              <Pencil className="h-3 w-3" /> Ação
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  /** Aplica todos os filtros de coluna, opcionalmente ignorando uma coluna. */
  function aplica(lista: Item[], exceto: string) {
    return lista.filter((i) =>
      colunas.every((c) =>
        c.id === exceto ? true : combinaFiltro(filtros[c.id], c.valor(i)),
      ),
    );
  }

  function opcoes(coluna: Coluna): OpcaoColuna[] {
    const map = new Map<string, number>();
    for (const i of aplica(itens, coluna.id)) {
      const v = coluna.valor(i);
      const texto = v === null || v === "" ? "(vazio)" : String(v);
      map.set(texto, (map.get(texto) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([valor, qtd]) => ({ valor, qtd }))
      .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR", { numeric: true }));
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = aplica(itens, "").filter((i) =>
      !termo
        ? true
        : [i.nro_nf, i.cod_pedido, i.cliente, i.cidade ?? "", i.transportadora]
            .join(" ")
            .toLowerCase()
            .includes(termo),
    );
    if (!sort) return base;
    const col = colunas.find((c) => c.id === sort.id);
    if (!col) return base;
    const mult = sort.dir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      const va = col.valor(a);
      const vb = col.valor(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * mult;
      return String(va).localeCompare(String(vb), "pt-BR", { numeric: true }) * mult;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, busca, filtros, sort, colunas]);

  const totais = useMemo(
    () => ({
      nfs: filtrados.length,
      clientes: new Set(filtrados.map((i) => i.cod_cliente ?? i.chave)).size,
      peso: filtrados.reduce((s, i) => s + (Number(i.peso) || 0), 0),
      valor: filtrados.reduce((s, i) => s + (Number(i.valor) || 0), 0),
    }),
    [filtrados],
  );

  const qtdFiltros = contarFiltros(filtros);

  function exportar() {
    if (!filtrados.length) {
      toast.info("Nada para exportar com os filtros atuais.");
      return;
    }
    const headers = colunas.map((c) => c.header);
    const rows = filtrados.map((i) =>
      colunas.map((c) => {
        if (c.id === "acao") {
          const a = i.acao;
          return [a?.acao, a?.responsavel, a?.prazo ? dataBr(a.prazo) : null]
            .filter(Boolean)
            .join(" · ");
        }
        const v = c.valor(i);
        if (c.tipo === "date") return dataBr(v == null ? null : String(v));
        if (c.tipo === "number") return v == null ? null : Number(v);
        return v == null ? "" : String(v);
      }),
    );
    const footer = colunas.map((c) => {
      if (c.id === "nro_nf") return `Total: ${totais.nfs} notas / ${totais.clientes} entregas`;
      if (c.id === "valor") return totais.valor;
      if (c.id === "peso") return totais.peso;
      return "";
    });
    void exportarXlsx({
      fileName: nomeArquivoComData("entregas-em-aberto"),
      sheetName: "ABERTOS",
      headers,
      rows,
      footer,
    }).catch(() => toast.error("Não foi possível gerar o arquivo."));
  }

  const mutSalvar = useMutation({
    mutationFn: async (vars: { nroNf: string; codPedido: string }) =>
      salvar({
        data: {
          nroNf: vars.nroNf,
          codPedido: vars.codPedido,
          acao: form.acao || null,
          responsavel: form.responsavel || null,
          prazo: form.prazo || null,
        },
      }),
    onSuccess: () => {
      toast.success("Anotação salva");
      setEditando(null);
      void qc.invalidateQueries({ queryKey: ["entregas-acoes"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  const emEdicao = filtrados.find((i) => i.chave === editando);
  const carregandoTudo = entregasQ.isLoading || carregando;

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || filtrados.length === 0) return;

    const areaPrincipal = grid.closest("main");
    if (!areaPrincipal) return;
    let frame = 0;

    const ajustarAltura = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const topoAreaPrincipal = areaPrincipal.getBoundingClientRect().top;
        const espacamentoSuperior = Number.parseFloat(
          window.getComputedStyle(areaPrincipal).paddingTop,
        );
        const alturaTotalizador = totalizadorRef.current?.getBoundingClientRect().height ?? 0;
        const margemInferior = 8;
        const alturaDisponivel = Math.max(
          220,
          Math.floor(
            window.innerHeight -
              topoAreaPrincipal -
              espacamentoSuperior -
              alturaTotalizador -
              margemInferior,
          ),
        );
        setAlturaGrid((atual) => (atual === alturaDisponivel ? atual : alturaDisponivel));
      });
    };

    ajustarAltura();
    window.addEventListener("resize", ajustarAltura);
    window.addEventListener("orientationchange", ajustarAltura);

    const observador = new ResizeObserver(ajustarAltura);
    if (totalizadorRef.current) observador.observe(totalizadorRef.current);
    observador.observe(areaPrincipal);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", ajustarAltura);
      window.removeEventListener("orientationchange", ajustarAltura);
      observador.disconnect();
    };
  }, [filtrados.length, carregandoTudo]);

  return (
    <AppShell>
      <div className="space-y-3 pb-12">
        <div>
          <h1 className="text-xl font-semibold">Entregas em aberto</h1>
          <p className="text-xs text-muted-foreground">
            Notas fiscais já expedidas e ainda sem confirmação de entrega.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por NF, pedido, cliente ou cidade"
            className="h-9 pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Card className="flex-1">
            <CardContent className="flex items-center gap-3 p-3">
              <PackageSearch className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-semibold leading-none">{totais.nfs}</p>
                <p className="text-xs text-muted-foreground">
                  entregas pendentes · {totais.peso.toFixed(0)} kg · {brl(totais.valor)}
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col gap-1.5">
            <FilterViewsBar
              tableKey="entregas-abertas"
              definicaoAtual={{ columnFilters: filtros, sort }}
              onAplicar={(def) =>
                aplicarConjunto({
                  columnFilters: (def.columnFilters ?? {}) as typeof filtros,
                  sort: def.sort ?? null,
                })
              }
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={exportar}
              disabled={!filtrados.length}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Exportar Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              disabled={!qtdFiltros}
              onClick={limparFiltros}
            >
              <FilterX className="h-3.5 w-3.5" />
              Limpar filtros{qtdFiltros ? ` (${qtdFiltros})` : ""}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={restaurarPadrao}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
            </Button>
          </div>
        </div>

        {carregandoTudo && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando entregas…
          </div>
        )}
        {entregasQ.error && (
          <p className="py-8 text-sm text-destructive">
            Não foi possível carregar as entregas.
          </p>
        )}
        {!carregandoTudo && filtrados.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <PackageSearch className="h-6 w-6" />
            Nenhuma entrega em aberto para os filtros escolhidos.
          </div>
        )}

        {!carregandoTudo && filtrados.length > 0 && (
          <div
            ref={gridRef}
            className="relative overflow-auto rounded-lg border"
            style={{ height: alturaGrid ? `${alturaGrid}px` : "calc(100dvh - 112px)" }}
          >
            <Table
              wrapperClassName="overflow-visible"
              className="min-w-[1400px] text-xs border-separate border-spacing-0"
            >
              <TableHeader className="sticky top-0 z-30 bg-card shadow-sm">
                <TableRow>
                  {colunas.map((c) => (
                    <TableHead
                      key={c.id}
                      className={`bg-card whitespace-nowrap border-b ${c.align === "right" ? "text-right" : ""}`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <ColumnFilter
                          label={c.header}
                          tipo={c.tipo}
                          opcoes={c.tipo === "text" ? opcoes(c) : []}
                          filtro={filtros[c.id]}
                          onChange={(f) => setFiltro(c.id, f)}
                          ordem={sort?.id === c.id ? sort.dir : null}
                          onOrdenar={(dir) => setSort({ id: c.id, dir })}
                        />
                        {sort?.id === c.id &&
                          (sort.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-primary" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-primary" />
                          ))}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((i) => {
                  const atrasada = i.dias !== null && i.dias > 10;
                  return (
                    <TableRow key={i.chave} className={atrasada ? "bg-destructive/5" : undefined}>
                      {colunas.map((c) => (
                        <TableCell
                          key={c.id}
                          className={`${c.align === "right" ? "text-right " : ""}${
                            c.className ?? "whitespace-nowrap"
                          }`}
                        >
                          {c.cell(i)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {filtrados.length > 0 && (
        <div
          ref={totalizadorRef}
          className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-3 py-2 text-xs backdrop-blur"
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <span>
              <strong>{totais.nfs}</strong> notas · <strong>{totais.clientes}</strong> entregas
            </span>
            <span>
              {totais.peso.toFixed(0)} kg · {brl(totais.valor)}
            </span>
          </div>
        </div>
      )}

      <Sheet open={!!editando} onOpenChange={(o) => !o && setEditando(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-base">
              {emEdicao ? `NF ${emEdicao.nro_nf} · ${emEdicao.cliente}` : "Ação"}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <Label className="text-xs">Ação</Label>
              <Textarea
                rows={3}
                value={form.acao}
                onChange={(e) => setForm((f) => ({ ...f, acao: e.target.value }))}
                placeholder="O que será feito para concluir a entrega"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável</Label>
              <Input
                value={form.responsavel}
                onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prazo</Label>
              <Input
                type="date"
                value={form.prazo}
                onChange={(e) => setForm((f) => ({ ...f, prazo: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={mutSalvar.isPending || !emEdicao}
              onClick={() =>
                emEdicao &&
                mutSalvar.mutate({ nroNf: emEdicao.nro_nf, codPedido: emEdicao.cod_pedido })
              }
            >
              {mutSalvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
