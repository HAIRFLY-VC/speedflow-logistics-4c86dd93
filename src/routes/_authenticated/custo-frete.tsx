import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listVendedoresExternos } from "@/lib/external-catalog.functions";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BackButton } from "@/components/layout/BackButton";
import { exportarXlsx } from "@/components/data-table/export-xlsx";
import {
  calendarioComercialQueryOptions,
  carregarCustoFrete,
  cicloAtual,
  custoFreteQueryOptions,
  resumir,
  type CicloComercial,
  type LinhaCustoFrete,
} from "@/lib/custo-frete.query";

export const Route = createFileRoute("/_authenticated/custo-frete")({
  head: () => ({
    meta: [
      { title: "Custo de Frete — SpeedFlow Logistics" },
      { name: "description", content: "Custo com frete por ciclo comercial em diversas dimensões." },
      { property: "og:title", content: "Custo de Frete — SpeedFlow Logistics" },
      { property: "og:description", content: "Custo com frete por ciclo comercial em diversas dimensões." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CustoFretePage,
});

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const pctFmt = (v: number | null) => (v == null ? "—" : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`);
const diaBr = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
export const rotuloCiclo = (c: CicloComercial) => {
  const [a, m] = c.mes_comerc.split("-");
  const mes = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${mes}/${a.slice(2)} (${diaBr(c.de)} a ${diaBr(c.ate)})`;
};

const rotuloVendedor = (cod: string | null, vend?: Map<string, string>) => {
  if (!cod) return "Sem vendedor";
  const nome = vend?.get(cod)?.trim();
  return nome ? `${nome} (${cod})` : cod;
};

type Dim = { id: string; titulo: string; chave: (l: LinhaCustoFrete, vend?: Map<string, string>) => string };
const DIMENSOES: Dim[] = [
  { id: "resp", titulo: "Fretista / Transportadora", chave: (l) => (l.responsavel ? `${l.responsavel}${l.tipo ? ` · ${l.tipo}` : ""}` : "Sem frete confirmado") },
  { id: "uf", titulo: "UF", chave: (l) => l.uf ?? "Sem UF" },
  { id: "cidade", titulo: "Cidade", chave: (l) => (l.cidade ? `${l.cidade}${l.uf ? `/${l.uf}` : ""}` : "Sem cidade") },
  { id: "cliente", titulo: "Cliente", chave: (l) => l.cliente },
  { id: "vendedor", titulo: "Vendedor", chave: (l, vend) => rotuloVendedor(l.cod_vendedor, vend) },
  { id: "rota", titulo: "Rota", chave: (l) => l.rota ?? "Sem frete confirmado" },
];

type Grupo = { nome: string; frete: number; valor: number; peso: number; pedidos: number; pct: number | null };

function agrupar(linhas: LinhaCustoFrete[], dim: Dim, vend?: Map<string, string>): Grupo[] {
  const m = new Map<string, { frete: number; valor: number; peso: number; pedidos: Set<string> }>();
  for (const l of linhas) {
    const k = dim.chave(l, vend);
    const g = m.get(k) ?? { frete: 0, valor: 0, peso: 0, pedidos: new Set<string>() };
    g.frete += l.frete; g.valor += l.valor; g.peso += l.peso; g.pedidos.add(l.cod_pedido);
    m.set(k, g);
  }
  return Array.from(m, ([nome, g]) => ({ nome, frete: g.frete, valor: g.valor, peso: g.peso, pedidos: g.pedidos.size, pct: g.valor > 0 ? (g.frete / g.valor) * 100 : null }));
}

type Ordem = "frete" | "valor" | "pct" | "pedidos";

function TabelaDimensao({ dim, linhas, ciclo, vendMap }: { dim: Dim; linhas: LinhaCustoFrete[]; ciclo: string; vendMap?: Map<string, string> }) {
  const [ordem, setOrdem] = useState<Ordem>("frete");
  const grupos = useMemo(() => agrupar(linhas, dim, vendMap).sort((a, b) => (b[ordem] ?? -1) - (a[ordem] ?? -1)), [linhas, dim, ordem, vendMap]);
  const maxFrete = Math.max(1, ...grupos.map((g) => g.frete));
  const th = (id: Ordem, t: string) => (
    <th className="cursor-pointer px-2 py-1 text-right font-medium hover:text-foreground" onClick={() => setOrdem(id)}>
      {t}{ordem === id ? " ↓" : ""}
    </th>
  );
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="text-sm">{dim.titulo}</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            exportarXlsx({
              fileName: `custo-frete-${dim.id}-${ciclo}.xlsx`,
              headers: [dim.titulo, "Frete (R$)", "Mercadorias (R$)", "% Frete", "Pedidos", "Peso (kg)"],
              rows: grupos.map((g) => [g.nome, Number(g.frete.toFixed(2)), Number(g.valor.toFixed(2)), g.pct == null ? null : Number(g.pct.toFixed(2)), g.pedidos, Number(g.peso.toFixed(2))]),
            })
          }
        >
          <Download className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="max-h-96 overflow-auto p-4 pt-0">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card text-muted-foreground">
            <tr>
              <th className="px-2 py-1 text-left font-medium">{dim.titulo}</th>
              {th("frete", "Frete")}
              {th("valor", "Mercadorias")}
              {th("pct", "% Frete")}
              {th("pedidos", "Pedidos")}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.nome} className="border-t">
                <td className="px-2 py-1">
                  <div className="truncate max-w-[260px]" title={g.nome}>{g.nome}</div>
                  <div className="mt-0.5 h-1 rounded bg-muted">
                    <div className="h-1 rounded bg-primary" style={{ width: `${(g.frete / maxFrete) * 100}%` }} />
                  </div>
                </td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{brl.format(g.frete)}</td>
                <td className="px-2 py-1 text-right tabular-nums whitespace-nowrap">{brl.format(g.valor)}</td>
                <td className="px-2 py-1 text-right tabular-nums font-semibold">{pctFmt(g.pct)}</td>
                <td className="px-2 py-1 text-right tabular-nums">{g.pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function Evolucao({ ciclos }: { ciclos: CicloComercial[] }) {
  const ultimos = ciclos.slice(0, 6);
  const q = useQuery({
    queryKey: ["custo-frete-evolucao", ultimos.map((c) => c.mes_comerc).join(",")],
    queryFn: async () => Promise.all(ultimos.map(async (c) => ({ c, r: resumir(await carregarCustoFrete(c)) }))),
    enabled: ultimos.length > 0,
    staleTime: 10 * 60_000,
  });
  const dados = (q.data ?? []).slice().reverse();
  const max = Math.max(0.01, ...dados.map((d) => d.r.pct ?? 0));
  return (
    <Card>
      <CardHeader className="p-4 pb-2"><CardTitle className="text-sm">Evolução do % de frete (últimos 6 ciclos)</CardTitle></CardHeader>
      <CardContent className="p-4 pt-0">
        {q.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : q.isError ? (
          <p className="text-xs text-destructive">Não foi possível carregar a evolução.</p>
        ) : (
          <div className="flex h-48 items-end gap-3">
            {dados.map(({ c, r }) => (
              <div key={c.mes_comerc} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-semibold tabular-nums">{pctFmt(r.pct)}</span>
                <div className="w-full rounded-t bg-primary" style={{ height: `${((r.pct ?? 0) / max) * 140}px` }} title={`Frete ${brl.format(r.frete)} · Mercadorias ${brl.format(r.valor)}`} />
                <span className="text-[10px] text-muted-foreground">{rotuloCiclo(c).split(" ")[0]}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustoFretePage() {
  const calQ = useQuery(calendarioComercialQueryOptions());
  const ciclos = calQ.data ?? [];
  const [sel, setSel] = useState<string | null>(null);
  const ciclo = ciclos.find((c) => c.mes_comerc === sel) ?? cicloAtual(ciclos);
  const q = useQuery(custoFreteQueryOptions(ciclo));
  const linhas = q.data ?? [];
  const r = resumir(linhas);

  const kpis: [string, string][] = [
    ["% Frete", pctFmt(r.pct)],
    ["Frete (real + provisionado)", brl.format(r.frete)],
    ["Mercadorias faturadas", brl.format(r.valor)],
    ["Pedidos", r.pedidos.toLocaleString("pt-BR")],
    ["Entregas", r.entregas.toLocaleString("pt-BR")],
    ["Peso", `${kg.format(r.peso)} kg`],
    ["Frete por kg", r.peso > 0 ? brl.format(r.frete / r.peso) : "—"],
    ["Pedidos sem frete (real ou provisionado)", r.semFrete.toLocaleString("pt-BR")],
  ];

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <BackButton fallbackTo="/rotas" fallbackLabel="Rotas Pendentes" className="-ml-2 mb-1" />
          <h1 className="text-2xl font-bold">Custo de Frete</h1>
          <p className="text-sm text-muted-foreground">
            Frete real do ERP ou provisionado sobre as notas faturadas no ciclo comercial (mesmo critério de Mercadorias faturadas).
          </p>
        </div>
        <Select value={ciclo?.mes_comerc ?? ""} onValueChange={setSel}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Ciclo comercial" /></SelectTrigger>
          <SelectContent>
            {ciclos.slice(0, 12).map((c) => (
              <SelectItem key={c.mes_comerc} value={c.mes_comerc}>{rotuloCiclo(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {calQ.isSuccess && ciclos.length === 0 && (
        <p className="text-sm text-muted-foreground">Calendário comercial vazio. Rode o Sync ERP.</p>
      )}
      {q.isError && <p className="text-sm text-destructive">Não foi possível carregar os dados de frete: {(q.error as Error)?.message}</p>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(([t, v]) => {
          const card = (
            <Card className={t === "Mercadorias faturadas" ? "h-full cursor-pointer transition hover:border-primary hover:shadow-md" : undefined}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{t}{t === "Mercadorias faturadas" ? " ›" : ""}</p>
                <p className="text-lg font-bold tabular-nums">{q.isLoading ? "…" : v}</p>
              </CardContent>
            </Card>
          );
          return t === "Mercadorias faturadas" ? (
            <Link key={t} to="/custo-frete-mercadorias" search={{ ciclo: ciclo?.mes_comerc }} title="Ver detalhamento">{card}</Link>
          ) : (
            <div key={t}>{card}</div>
          );
        })}
      </div>

      <Evolucao ciclos={ciclos} />

      <div className="grid gap-4 lg:grid-cols-2">
        {DIMENSOES.map((d) => (
          <TabelaDimensao key={d.id} dim={d} linhas={linhas} ciclo={ciclo?.mes_comerc ?? ""} />
        ))}
      </div>
    </div>
  );
}
