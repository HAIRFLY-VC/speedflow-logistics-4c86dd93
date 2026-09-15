import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Clock, Boxes, Loader2, PackageCheck, RefreshCw, Timer, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MultiFiltro, type OpcaoFiltro } from "@/components/pedidos-sem-rota/MultiFiltro";
import { carregarSeparacao, type SeparacaoRow } from "@/lib/separacao.functions";

export const Route = createFileRoute("/_authenticated/separacao")({
  component: SeparacaoPage,
  head: () => ({
    meta: [
      { title: "Separação de pedidos | Speedflow" },
      {
        name: "description",
        content:
          "Indicadores de fila, tempos e produtividade da equipe de separação de pedidos.",
      },
      { property: "og:title", content: "Separação de pedidos | Speedflow" },
      {
        property: "og:description",
        content: "Acompanhe fila, tempos e produtividade da separação em tempo real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function horas(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return ms / 3_600_000;
}

/** Formata uma duração em horas como "2h15" ou "18min". */
function dur(h: number | null | undefined): string {
  if (h == null || !Number.isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  const horasInt = Math.floor(h);
  const min = Math.round((h - horasInt) * 60);
  return `${horasInt}h${String(min).padStart(2, "0")}`;
}

/** Data preenchida e válida? Strings vazias/inválidas contam como ausentes. */
function temData(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = String(v).trim();
  if (!s) return false;
  return Number.isFinite(new Date(s).getTime());
}

function media(valores: (number | null)[]): number | null {
  const v = valores.filter((x): x is number => x != null);
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function Indicador({
  titulo,
  valor,
  detalhe,
  icone: Icone,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  icone: typeof Clock;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-md bg-muted p-2">
          <Icone className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
          <p className="text-xl font-semibold leading-tight">{valor}</p>
          {detalhe ? <p className="text-xs text-muted-foreground">{detalhe}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SeparacaoPage() {
  const carregar = useServerFn(carregarSeparacao);

  const hoje = new Date();
  const [preset, setPreset] = useState<"hoje" | "7" | "30" | "livre">("hoje");
  const [inicio, setInicio] = useState(ymd(hoje));
  const [fim, setFim] = useState(ymd(hoje));
  const [separadores, setSeparadores] = useState<string[]>([]);

  function aplicarPreset(p: "hoje" | "7" | "30") {
    const f = new Date();
    const i = new Date();
    if (p === "7") i.setDate(i.getDate() - 6);
    if (p === "30") i.setDate(i.getDate() - 29);
    setPreset(p);
    setInicio(ymd(i));
    setFim(ymd(f));
  }

  const q = useQuery({
    queryKey: ["separacao", inicio, fim],
    queryFn: () => carregar({ data: { inicio: `${inicio}T00:00:00`, fim: `${fim}T23:59:59` } }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  const atualizadoEm = q.dataUpdatedAt
    ? new Date(q.dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const periodoTodos: SeparacaoRow[] = q.data?.periodo ?? [];
  const abertosTodos: SeparacaoRow[] = q.data?.abertos ?? [];

  const opcoesSeparador: OpcaoFiltro[] = useMemo(() => {
    const mapa = new Map<string, { qtd: number; kg: number; valor: number }>();
    for (const r of [...periodoTodos, ...abertosTodos]) {
      const nome = r.separador?.trim() || "(vazio)";
      const atual = mapa.get(nome) ?? { qtd: 0, kg: 0, valor: 0 };
      atual.qtd += 1;
      atual.kg += r.qtd_cx_sep ?? 0;
      mapa.set(nome, atual);
    }
    return [...mapa.entries()]
      .map(([valor, a]) => ({ valor, qtd: a.qtd, peso: 0, valorTotal: 0 }))
      .sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR"));
  }, [periodoTodos, abertosTodos]);

  const filtra = (rows: SeparacaoRow[]) =>
    separadores.length
      ? rows.filter((r) => separadores.includes(r.separador?.trim() || "(vazio)"))
      : rows;

  const periodo = useMemo(() => filtra(periodoTodos), [periodoTodos, separadores]);
  const abertos = useMemo(() => filtra(abertosTodos), [abertosTodos, separadores]);

  // Em aberto = sem fim de separação. Fila = sem início; em andamento = com
  // início e sem fim.
  const emAndamentoOuFila = abertos.filter((r) => !temData(r.dt_fim_sep));
  const fila = emAndamentoOuFila.filter((r) => !temData(r.dt_ini_sep));
  const andamento = emAndamentoOuFila.filter((r) => temData(r.dt_ini_sep));

  const agora = new Date().toISOString();
  const esperaMaisAntigo = media([
    fila.length ? horas(fila[0]?.dt_inc ?? null, agora) : null,
  ]);

  const caixas = periodo.reduce((s, r) => s + (r.qtd_cx_sep ?? 0), 0);
  const tEspera = media(periodo.map((r) => horas(r.dt_inc, r.dt_ini_sep)));
  const tSep = media(periodo.map((r) => horas(r.dt_ini_sep, r.dt_fim_sep)));
  const tConf = media(periodo.map((r) => horas(r.dt_fim_sep, r.dt_fim_conf)));
  const horasTrabalhadas = periodo.reduce(
    (s, r) => s + (horas(r.dt_ini_sep, r.dt_fim_sep) ?? 0),
    0,
  );
  const cxHora = horasTrabalhadas > 0 ? caixas / horasTrabalhadas : null;
  const separadoresAtivos = new Set(andamento.map((r) => r.separador)).size;

  /** Produtividade por separador dentro do período. */
  const produtividade = useMemo(() => {
    const mapa = new Map<
      string,
      { pedidos: number; caixas: number; horas: number; tempos: (number | null)[]; conf: (number | null)[] }
    >();
    for (const r of periodo) {
      const nome = r.separador?.trim() || "(sem separador)";
      const a =
        mapa.get(nome) ?? { pedidos: 0, caixas: 0, horas: 0, tempos: [], conf: [] };
      a.pedidos += 1;
      a.caixas += r.qtd_cx_sep ?? 0;
      const t = horas(r.dt_ini_sep, r.dt_fim_sep);
      if (t != null) a.horas += t;
      a.tempos.push(t);
      a.conf.push(horas(r.dt_fim_sep, r.dt_fim_conf));
      mapa.set(nome, a);
    }
    return [...mapa.entries()]
      .map(([nome, a]) => ({
        nome,
        pedidos: a.pedidos,
        caixas: a.caixas,
        cxHora: a.horas > 0 ? a.caixas / a.horas : null,
        tempoMedio: media(a.tempos),
        confMedia: media(a.conf),
      }))
      .sort((a, b) => b.caixas - a.caixas);
  }, [periodo]);

  /** Pedidos e caixas concluídos por dia. */
  const porDia = useMemo(() => {
    const mapa = new Map<string, { pedidos: number; caixas: number }>();
    for (const r of periodo) {
      if (!r.dt_fim_sep) continue;
      const dia = r.dt_fim_sep.slice(0, 10);
      const a = mapa.get(dia) ?? { pedidos: 0, caixas: 0 };
      a.pedidos += 1;
      a.caixas += r.qtd_cx_sep ?? 0;
      mapa.set(dia, a);
    }
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, a]) => ({ dia: dia.slice(8, 10) + "/" + dia.slice(5, 7), ...a }));
  }, [periodo]);

  /** Distribuição da conclusão por hora do dia. */
  const porHora = useMemo(() => {
    const base = Array.from({ length: 24 }, (_, h) => ({ hora: `${h}h`, pedidos: 0, caixas: 0 }));
    for (const r of periodo) {
      if (!r.dt_fim_sep) continue;
      const h = new Date(r.dt_fim_sep).getHours();
      const item = base[h];
      if (!item) continue;
      item.pedidos += 1;
      item.caixas += r.qtd_cx_sep ?? 0;
    }
    return base;
  }, [periodo]);

  /** Envelhecimento da fila aguardando início. */
  const envelhecimento = useMemo(() => {
    const faixas = [
      { faixa: "até 2h", max: 2, pedidos: 0 },
      { faixa: "2–8h", max: 8, pedidos: 0 },
      { faixa: "8–24h", max: 24, pedidos: 0 },
      { faixa: "+24h", max: Infinity, pedidos: 0 },
    ];
    for (const r of fila) {
      const h = horas(r.dt_inc, agora) ?? 0;
      const alvo = faixas.find((f) => h <= f.max) ?? faixas[3]!;
      alvo.pedidos += 1;
    }
    return faixas;
  }, [fila, agora]);

  const emAberto = [...abertos].sort(
    (a, b) => new Date(a.dt_inc ?? 0).getTime() - new Date(b.dt_inc ?? 0).getTime(),
  );

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Separação de pedidos</h1>
            <p className="text-sm text-muted-foreground">
              Fila, tempos e produtividade da equipe de separação.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex gap-1">
              {(["hoje", "7", "30"] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={preset === p ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => aplicarPreset(p)}
                >
                  {p === "hoje" ? "Hoje" : `${p} dias`}
                </Button>
              ))}
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">De</Label>
              <Input
                type="date"
                value={inicio}
                className="h-8 w-[140px] text-xs"
                onChange={(e) => {
                  setPreset("livre");
                  setInicio(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase text-muted-foreground">Até</Label>
              <Input
                type="date"
                value={fim}
                className="h-8 w-[140px] text-xs"
                onChange={(e) => {
                  setPreset("livre");
                  setFim(e.target.value);
                }}
              />
            </div>
            <MultiFiltro
              label="Separador"
              opcoes={opcoesSeparador}
              selecionados={separadores}
              onChange={setSeparadores}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={q.isFetching}
                onClick={() => void q.refetch()}
              >
                <RefreshCw className={`mr-1 h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {atualizadoEm ? (
                <span className="text-[11px] text-muted-foreground">às {atualizadoEm}</span>
              ) : null}
            </div>
          </div>
        </div>

        {q.isLoading ? (
          <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores…
          </div>
        ) : q.isError ? (
          <p className="p-6 text-sm text-destructive">
            {q.error instanceof Error
              ? q.error.message
              : "Não foi possível carregar os dados da separação."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Indicador
                titulo="Na fila"
                valor={num(fila.length)}
                detalhe={
                  fila.length ? `mais antigo há ${dur(esperaMaisAntigo)}` : "nenhum pedido aguardando"
                }
                icone={Clock}
              />
              <Indicador
                titulo="Em separação agora"
                valor={num(andamento.length)}
                detalhe={`${separadoresAtivos} separador(es) ativo(s)`}
                icone={Users}
              />
              <Indicador
                titulo="Concluídos no período"
                valor={num(periodo.length)}
                detalhe={`${num(caixas)} caixas separadas`}
                icone={PackageCheck}
              />
              <Indicador
                titulo="Caixas por hora"
                valor={cxHora != null ? num(cxHora) : "—"}
                detalhe="produtividade média da equipe"
                icone={Boxes}
              />
              <Indicador titulo="Tempo médio de espera" valor={dur(tEspera)} detalhe="liberação → início" icone={Timer} />
              <Indicador titulo="Tempo médio de separação" valor={dur(tSep)} detalhe="início → fim" icone={Timer} />
              <Indicador titulo="Tempo médio de conferência" valor={dur(tConf)} detalhe="fim da separação → conferido" icone={Timer} />
              <Indicador
                titulo="Fila acima de 24h"
                valor={num(envelhecimento[3]?.pedidos ?? 0)}
                detalhe="pedidos parados há mais de um dia"
                icone={Clock}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Volume por dia</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porDia}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="dia" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="pedidos" name="Pedidos" fill="hsl(var(--primary))" />
                      <Bar dataKey="caixas" name="Caixas" fill="hsl(var(--muted-foreground))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Conclusões por hora do dia</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porHora}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="hora" fontSize={10} interval={1} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="pedidos" name="Pedidos" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Envelhecimento da fila</CardTitle>
                </CardHeader>
                <CardContent className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={envelhecimento} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" fontSize={11} allowDecimals={false} />
                      <YAxis type="category" dataKey="faixa" fontSize={11} width={60} />
                      <Tooltip />
                      <Bar dataKey="pedidos" name="Pedidos" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Produtividade por separador</CardTitle>
                </CardHeader>
                <CardContent className="max-h-[260px] overflow-auto p-0">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead className="text-xs">Separador</TableHead>
                        <TableHead className="text-right text-xs">Pedidos</TableHead>
                        <TableHead className="text-right text-xs">Caixas</TableHead>
                        <TableHead className="text-right text-xs">Cx/h</TableHead>
                        <TableHead className="text-right text-xs">Tempo méd.</TableHead>
                        <TableHead className="text-right text-xs">Conferência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {produtividade.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                            Nenhuma separação concluída no período.
                          </TableCell>
                        </TableRow>
                      ) : (
                        produtividade.map((p) => (
                          <TableRow key={p.nome}>
                            <TableCell className="text-xs">{p.nome}</TableCell>
                            <TableCell className="text-right text-xs">{num(p.pedidos)}</TableCell>
                            <TableCell className="text-right text-xs">{num(p.caixas)}</TableCell>
                            <TableCell className="text-right text-xs">
                              {p.cxHora != null ? num(p.cxHora) : "—"}
                            </TableCell>
                            <TableCell className="text-right text-xs">{dur(p.tempoMedio)}</TableCell>
                            <TableCell className="text-right text-xs">{dur(p.confMedia)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  Pedidos em aberto{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    ({num(emAberto.length)})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[420px] overflow-auto p-0">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="text-xs">Pedido</TableHead>
                      <TableHead className="text-xs">Separador</TableHead>
                      <TableHead className="text-xs">Situação</TableHead>
                      <TableHead className="text-right text-xs">Caixas</TableHead>
                      <TableHead className="text-xs">Liberado em</TableHead>
                      <TableHead className="text-right text-xs">Parado há</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {emAberto.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-xs text-muted-foreground">
                          Nenhum pedido pendente de separação.
                        </TableCell>
                      </TableRow>
                    ) : (
                      emAberto.map((r) => {
                        const h = horas(r.dt_inc, agora) ?? 0;
                        return (
                          <TableRow key={`${r.cod_pedido}-${r.cod_sep}`} className={h > 24 ? "bg-destructive/5" : ""}>
                            <TableCell className="text-xs font-mono">{r.cod_pedido}</TableCell>
                            <TableCell className="text-xs">{r.separador ?? "—"}</TableCell>
                            <TableCell className="text-xs">
                              <Badge variant={r.dt_ini_sep ? "default" : "secondary"} className="text-[10px]">
                                {r.dt_ini_sep ? "Em separação" : "Na fila"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">{num(r.qtd_cx_sep ?? 0)}</TableCell>
                            <TableCell className="text-xs">
                              {r.dt_inc
                                ? new Date(r.dt_inc).toLocaleString("pt-BR", {
                                    day: "2-digit",
                                    month: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "—"}
                            </TableCell>
                            <TableCell
                              className={`text-right text-xs ${h > 24 ? "font-semibold text-destructive" : ""}`}
                            >
                              {dur(h)}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
