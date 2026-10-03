import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/layout/AppShell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getTablePrefs,
  saveTablePrefs,
  type TablePreferences,
} from "@/lib/table-prefs.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/central/client";
import {
  ORDER_STATUS_LABEL,
  STATUS_TONE,
  formatCurrency,
  formatCurrencyNoSymbol,
  isStageLate,
  type OrderStatus,
  type SlaSettings,
} from "@/lib/orderStatus";
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Truck,
  DollarSign,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Visão geral — SpeedFlow Logistics" },
    { name: "description", content: "Acompanhe os pedidos e os indicadores da operação logística." },
    { property: "og:title", content: "Visão geral — SpeedFlow Logistics" },
    { property: "og:description", content: "Acompanhe os pedidos e os indicadores da operação logística." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: DashboardPage,
});

type OrderRow = {
  id: string;
  status: OrderStatus;
  total_amount: number;
  status_since: string;
  created_at: string;
  sla_deliver_by: string | null;
};

type MesComercial = { mes_comerc: string; de: string; ate: string };

type ModoCalendario = "normal" | "comercial";

// Chave do mês civil atual ("YYYY-MM").
function mesCivilAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function DashboardPage() {
  // Modo de análise (calendário normal x comercial), lembrado por usuário.
  const [modoCalendario, setModoCalendario] = useState<ModoCalendario>("normal");
  // Filtro de mês (civil "YYYY-MM" ou comercial "mes_comerc"). Sempre volta ao
  // mês vigente ao abrir ou ao trocar o modo de calendário.
  const [mesSelecionado, setMesSelecionado] = useState<string>(mesCivilAtual());
  const fetchPrefs = useServerFn(getTablePrefs);
  const savePrefs = useServerFn(saveTablePrefs);
  const prefTouched = useRef(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem("dashboard:calendario") === "comercial") {
        setModoCalendario("comercial");
      }
    } catch {
      /* sem storage */
    }
    fetchPrefs({ data: { tableKey: "dashboard:calendario" } })
      .then((remote) => {
        if (prefTouched.current) return;
        const v = (remote as { modo?: string } | null)?.modo;
        if (v === "comercial") setModoCalendario("comercial");
      })
      .catch(() => {
        /* mantém cópia local */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trocarCalendario = (v: string) => {
    prefTouched.current = true;
    const modo: ModoCalendario = v === "comercial" ? "comercial" : "normal";
    setModoCalendario(modo);
    try {
      window.localStorage.setItem("dashboard:calendario", modo);
    } catch {
      /* sem storage */
    }
    savePrefs({
      data: {
        tableKey: "dashboard:calendario",
        preferences: { modo } as unknown as TablePreferences,
      },
    }).catch(() => {});
  };

  // Calendário comercial do ERP (atualizado pelo Sync ERP). Se a tabela
  // ainda não existir/estiver vazia, o dashboard cai no calendário normal.
  const calendarioQ = useQuery({
    queryKey: ["erp", "calendario-comercial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_calendario_comercial")
        .select("mes_comerc,de,ate")
        .order("mes_comerc", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MesComercial[];
    },
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  const calendarioComercial = calendarioQ.data ?? [];
  const usandoComercial = modoCalendario === "comercial" && calendarioComercial.length > 0;

  // Mês vigente no modo efetivo: mês comercial que contém a data atual
  // (ou o mais recente do calendário) ou o mês civil atual.
  const mesVigente = useMemo(() => {
    if (usandoComercial) {
      const now = Date.now();
      const atual = calendarioComercial.find((m) => {
        const de = new Date(`${m.de}T00:00:00`).getTime();
        const ate = new Date(`${m.ate}T23:59:59.999`).getTime();
        return now >= de && now <= ate;
      });
      return (atual ?? calendarioComercial[0]).mes_comerc;
    }
    return mesCivilAtual();
  }, [usandoComercial, calendarioComercial]);

  // Ao trocar o modo de calendário (ou carregar o calendário comercial),
  // o filtro volta ao mês vigente do novo modo.
  useEffect(() => {
    setMesSelecionado(mesVigente);
  }, [mesVigente]);

  // Opções do seletor de mês, respeitando o modo de calendário.
  const opcoesMes = useMemo(() => {
    const fmtDia = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    if (usandoComercial) {
      return calendarioComercial.slice(0, 12).map((m) => {
        const [ano, mes] = m.mes_comerc.split("-");
        const label = new Date(Number(ano), Number(mes) - 1, 1)
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", "");
        return { key: m.mes_comerc, label: `${label}/${ano.slice(2)} (${fmtDia(m.de)} a ${fmtDia(m.ate)})` };
      });
    }
    const out: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = `${d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "")}/${String(d.getFullYear()).slice(2)}`;
      out.push({ key, label });
    }
    return out;
  }, [usandoComercial, calendarioComercial]);
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,total_amount,status_since,created_at,sla_deliver_by")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const slaQ = useQuery({
    queryKey: ["company_settings", "sla"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select(
          "sla_commercial_approval_hours,sla_credit_approval_hours,sla_fulfillment_hours,sla_delivery_hours",
        )
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data as SlaSettings | null;
    },
  });

  const orders = data ?? [];
  const now = Date.now();
  const sla = slaQ.data ?? null;

  // Pedidos do mês selecionado: base dos cartões (KPIs) e da lista de status.
  // O gráfico "Pedidos por mês" continua usando a lista completa (tendência).
  const pedidosDoMes = useMemo(() => {
    if (usandoComercial) {
      const m = calendarioComercial.find((x) => x.mes_comerc === mesSelecionado);
      if (!m) return orders;
      const de = new Date(`${m.de}T00:00:00`).getTime();
      const ate = new Date(`${m.ate}T23:59:59.999`).getTime();
      return orders.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return t >= de && t <= ate;
      });
    }
    const [ano, mes] = mesSelecionado.split("-");
    const de = new Date(Number(ano), Number(mes) - 1, 1).getTime();
    const ate = new Date(Number(ano), Number(mes), 0, 23, 59, 59, 999).getTime();
    return orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= de && t <= ate;
    });
  }, [usandoComercial, calendarioComercial, mesSelecionado, orders]);

  const totals = {
    total: pedidosDoMes.length,
    pendingApproval: pedidosDoMes.filter((o) =>
      ["aguardando_aprovacao_comercial", "aguardando_aprovacao_credito"].includes(o.status),
    ).length,
    inTransport: pedidosDoMes.filter((o) => o.status === "em_transporte").length,
    delivered: pedidosDoMes.filter((o) => o.status === "entregue").length,
    atRisk: pedidosDoMes.filter(
      (o) =>
        o.sla_deliver_by &&
        o.status !== "entregue" &&
        o.status !== "cancelado" &&
        new Date(o.sla_deliver_by).getTime() < now,
    ).length,
    stageLate: pedidosDoMes.filter((o) => isStageLate(o.status, o.status_since, sla)).length,
    revenue: pedidosDoMes.reduce((s, o) => s + Number(o.total_amount ?? 0), 0),
  };


  // Pedidos por mês (últimos 6 meses) — calendário normal ou comercial
  const monthly = (() => {
    if (usandoComercial) {
      // calendarioComercial vem ordenado desc; pega os 6 mais recentes
      const meses = calendarioComercial.slice(0, 6).reverse();
      const out = meses.map((m) => {
        const [ano, mes] = m.mes_comerc.split("-");
        const label = new Date(Number(ano), Number(mes) - 1, 1)
          .toLocaleDateString("pt-BR", { month: "short" })
          .replace(".", "");
        const fmtDia = (iso: string) =>
          new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          });
        return {
          key: m.mes_comerc,
          label,
          periodo: `${fmtDia(m.de)} a ${fmtDia(m.ate)}`,
          pedidos: 0,
        };
      });
      const faixas = meses.map((m) => ({
        de: new Date(`${m.de}T00:00:00`).getTime(),
        ate: new Date(`${m.ate}T23:59:59.999`).getTime(),
      }));
      for (const o of orders) {
        const t = new Date(o.created_at).getTime();
        for (let i = 0; i < faixas.length; i++) {
          if (t >= faixas[i].de && t <= faixas[i].ate) {
            out[i].pedidos += 1;
            break;
          }
        }
      }
      return out;
    }
    const out: { label: string; key: string; pedidos: number; periodo?: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      out.push({
        key,
        label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
        pedidos: 0,
      });
    }
    const idx = new Map(out.map((m, i) => [m.key, i]));
    for (const o of orders) {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const i = idx.get(key);
      if (i != null) out[i].pedidos += 1;
    }
    return out;
  })();

  // Tempo médio por etapa (em horas), a partir do histórico
  const stageHistoryQ = useQuery({
    queryKey: ["dashboard", "stage_times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("order_id,from_status,to_status,changed_at")
        .order("changed_at", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const avgByStage = (() => {
    const rows = stageHistoryQ.data ?? [];
    const byOrder = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = byOrder.get(r.order_id) ?? [];
      arr.push(r);
      byOrder.set(r.order_id, arr);
    }
    const totals: Record<string, { sum: number; n: number }> = {};
    for (const arr of byOrder.values()) {
      for (let i = 0; i < arr.length - 1; i++) {
        const stage = arr[i].to_status as string;
        const dur =
          (new Date(arr[i + 1].changed_at).getTime() - new Date(arr[i].changed_at).getTime()) /
          3600_000;
        if (dur < 0) continue;
        totals[stage] = totals[stage] ?? { sum: 0, n: 0 };
        totals[stage].sum += dur;
        totals[stage].n += 1;
      }
    }
    return (Object.keys(ORDER_STATUS_LABEL) as OrderStatus[])
      .filter((s) => totals[s]?.n)
      .map((s) => ({
        stage: ORDER_STATUS_LABEL[s],
        horas: Number((totals[s].sum / totals[s].n).toFixed(1)),
      }));
  })();

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral dos pedidos e da operação logística.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Analisar por:</span>
            <Select value={modoCalendario} onValueChange={trocarCalendario}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Calendário normal</SelectItem>
                <SelectItem value="comercial">Calendário comercial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
          <Kpi icon={ShoppingCart} label="Pedidos" value={totals.total} loading={isLoading} />
          <Kpi icon={Clock} label="Aguard. aprovação" value={totals.pendingApproval} loading={isLoading} />
          <Kpi icon={Truck} label="Em transporte" value={totals.inTransport} loading={isLoading} />
          <Kpi icon={CheckCircle2} label="Entregues" value={totals.delivered} loading={isLoading} tone="text-emerald-600" />
          <Kpi icon={AlertTriangle} label="SLA entrega" value={totals.atRisk} loading={isLoading} tone="text-destructive" />
          <Kpi icon={AlertTriangle} label="Etapa atrasada" value={totals.stageLate} loading={isLoading} tone="text-destructive" />
          <Kpi
            icon={DollarSign}
            label="Receita"
            value={formatCurrencyNoSymbol(totals.revenue)}
            loading={isLoading}
            compact
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pedidos por mês{usandoComercial ? " (calendário comercial)" : ""}
              </CardTitle>
              {modoCalendario === "comercial" && !usandoComercial && !calendarioQ.isFetching && (
                <p className="text-xs text-amber-600">
                  {calendarioQ.error
                    ? `Não foi possível ler o calendário comercial (${(calendarioQ.error as Error).message}) — exibindo calendário normal.`
                    : "Calendário comercial ainda não carregado — exibindo calendário normal. Rode o Sync ERP para atualizá-lo."}{" "}
                  <button type="button" className="underline" onClick={() => calendarioQ.refetch()}>
                    Tentar novamente
                  </button>
                </p>
              )}
            </CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthly} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload as {
                        label: string;
                        pedidos: number;
                        periodo?: string;
                      };
                      return (
                        <div
                          style={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: 8,
                            fontSize: 12,
                            padding: "6px 10px",
                          }}
                        >
                          <div className="font-medium">{d.label}</div>
                          {d.periodo && (
                            <div className="text-muted-foreground">{d.periodo}</div>
                          )}
                          <div>{d.pedidos} pedido(s)</div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tempo médio por etapa (h)</CardTitle>
            </CardHeader>
            <CardContent className="h-[260px]">
              {stageHistoryQ.isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : avgByStage.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sem histórico suficiente ainda.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={avgByStage}
                    layout="vertical"
                    margin={{ left: 8, right: 8, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} />
                    <YAxis
                      type="category"
                      dataKey="stage"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      width={130}
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="horas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {(() => {
          const byStatus = orders.reduce<Record<string, number>>((acc, o) => {
            acc[o.status] = (acc[o.status] ?? 0) + 1;
            return acc;
          }, {});
          return (




        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pedidos por status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid gap-2 md:grid-cols-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido cadastrado ainda. Os indicadores aparecerão aqui assim que houver dados.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((s) => {
                  const count = byStatus[s] ?? 0;
                  const pct = totals.total ? (count / totals.total) * 100 : 0;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span
                        className={`inline-flex min-w-[170px] items-center rounded-md border px-2 py-1 text-xs font-medium ${STATUS_TONE[s]}`}
                      >
                        {ORDER_STATUS_LABEL[s]}
                      </span>
                      <div className="flex-1 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-sm tabular-nums w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          );
        })()}
      </div>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  loading,
  tone,
  compact,
}: {
  icon: typeof ShoppingCart;
  label: string;
  value: string | number;
  loading?: boolean;
  tone?: string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <Icon className={`h-4 w-4 text-muted-foreground ${tone ?? ""}`} />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20 mt-2" />
        ) : (
          <div
            className={`mt-1 font-semibold tabular-nums leading-tight ${compact ? "text-xl" : "text-2xl"} ${tone ?? ""}`}
          >
            {value}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
