import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Loader2, RefreshCw, Package, Weight, ShoppingCart, MapPin, Calculator, Pencil } from "lucide-react";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { ErpSyncButton } from "@/components/layout/ErpSyncButton";
import { useClientesErp } from "@/hooks/useClientesErp";
import { supabase } from "@/integrations/central/client";
import { computeRoutePolyline } from "@/lib/route-directions.functions";
import { sequenceStops } from "@/components/route-suggestions/SuggestionMap";
import { getOrderCoord } from "@/lib/order-coords";
import {
  simularRota,
  tabelaVigenteDaTransportadora,
  type SimulacaoRota,
  type TabelaSim,
} from "@/lib/frete-simulacao";
import { RouteEditDialog, type EditableRoute } from "@/components/routes/RouteEditDialog";
import { PagamentoRotaDialog } from "@/components/routes/PagamentoRotaDialog";
import { useAuth } from "@/hooks/useAuth";
import {
  listarResponsaveisErp,
  listarResponsaveisDeRotasErp,
  sincronizarResponsaveisPorCodigo,
  type ResponsavelErp,
} from "@/lib/rota-erp.functions";





import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type ColumnDef } from "@/components/data-table/DataTable";
import type { Database } from "@/integrations/supabase/types";

type RouteStatus = Database["public"]["Enums"]["route_status"];

const ROUTE_STATUS_LABEL: Record<RouteStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
const ROUTE_STATUS_TONE: Record<RouteStatus, string> = {
  planejada: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  em_andamento: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30",
  concluida: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export type RotasViewProps = {
  /** Título exibido no topo da tela. */
  titulo: string;
  /** Texto de apoio abaixo do título. */
  descricao: string;
  /** Exibe o botão "Atualizar rotas" e "Nova rota". */
  mostrarAcoesDeRota?: boolean;
  /** Exibe o botão "Confirmar Pgto" na coluna de frete. */
  permitirConfirmacao?: boolean;
  /** Filtro adicional aplicado às rotas carregadas. */
  filtro?: (
    r: RouteRow,
    ctx: { bordero: { total: number; comBordero: number; faturados: number } },
  ) => boolean;
  /** Mensagem exibida quando não há rotas após o filtro. */
  mensagemVazia?: string;
  /** Chave de preferências da tabela (filtros/colunas por tela). */
  tableKey: string;
};

export type RouteRow = {
  id: string;
  code: string;
  erp_route_id: string | null;
  erp_status: string | null;
  route_date: string;
  status: RouteStatus;
  total_freight: number;
  total_distance_km: number | null;
  driver_name: string | null;
  notes: string | null;
  freight_carriers: {
    full_name: string;
    vehicle_plate: string | null;
    transportadoras: { id: string; cod_erp: string | null } | null;
  } | null;
  route_orders: {
    stop_order: number | null;
    orders: {
      customer_id: string | null;
      erp_cod_cliente: string | null;
      order_number: string | null;
      total_amount: number | null;
      weight: number | null;
      erp_status: string | null;
      bordero: string | null;
      delivery_latitude: number | null;
      delivery_longitude: number | null;
    } | null;
  }[];
  frete_confirmado_em?: string | null;
  bordero_emitido_em?: string | null;
};


const currencyFmt = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const weightFmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatRouteDate(value: string | null | undefined): string {
  if (!value) return "Não planejado";
  const str = String(value);
  if (str.startsWith("4000-01-01")) return "Não planejado";
  if (str.startsWith("3000-01-01")) return "Sem data prevista";
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dmy = String(value).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (dmy) {
    const d = dmy[1].padStart(2, "0");
    const m = dmy[2].padStart(2, "0");
    let y = dmy[3];
    if (y.length === 2) y = `20${y}`;
    return `${d}/${m}/${y}`;
  }
  return String(value);
}

function routeDateSortKey(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (!str || str.startsWith("4000-01-01")) return "z";
  if (str.startsWith("3000-01-01")) return "y";
  return str;
}

function nomeRotaOf(r: RouteRow) {
  return r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code;
}
function normalizaCod(v: string | null | undefined): string {
  return String(v ?? "").trim().replace(/^0+/, "");
}
function motoristaOf(
  r: RouteRow,
  codFallback?: string | null,
  responsavel?: { razaoSocial: string; codErp: string },
) {
  const name = responsavel?.razaoSocial || r.driver_name || r.freight_carriers?.full_name || "";
  const cod = responsavel?.codErp || r.freight_carriers?.transportadoras?.cod_erp || codFallback || null;
  // Sem nome não há responsável de fato: não exibir código solto.
  if (!name.trim() || !normalizaNome(name)) return "";
  if (cod) return `${name} (${cod})`;
  return name; 

}

type TransportadoraLite = { id: string; razao_social: string; cod_erp: string | null };

const normalizaNome = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

/**
 * Resolve a transportadora da rota. Prioriza o vínculo por `freight_carriers`;
 * quando a rota veio do ERP sem esse vínculo, casa pelo nome (o ERP trunca a
 * razão social, então comparamos por prefixo).
 */
function resolveTransportadora(
  r: RouteRow,
  transportadoras: TransportadoraLite[],
): TransportadoraLite | null {
  const vinculada = r.freight_carriers?.transportadoras?.id;
  if (vinculada) {
    return (
      transportadoras.find((t) => t.id === vinculada) ?? {
        id: vinculada,
        razao_social: "",
        cod_erp: r.freight_carriers?.transportadoras?.cod_erp ?? null,
      }
    );
  }
  const nome = normalizaNome(r.driver_name ?? r.freight_carriers?.full_name ?? "");
  if (nome.length < 4) return null;
  return (
    transportadoras.find((t) => {
      const alvo = normalizaNome(t.razao_social ?? "");
      if (alvo.length < 4) return false;
      return alvo === nome || alvo.startsWith(nome) || nome.startsWith(alvo);
    }) ?? null

  );
}

export type TipoFrete = "F" | "T" | "P";
const TIPO_FRETE_LABEL: Record<TipoFrete, string> = {
  F: "Fretista",
  T: "Transportadora",
  P: "Frota própria",
};
const TIPO_FRETE_TONE: Record<TipoFrete, string> = {
  F: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  T: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  P: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};


function paradasOf(r: RouteRow) {
  const set = new Set<string>();
  for (const ro of r.route_orders ?? []) {
    if (ro.orders?.customer_id) set.add(ro.orders.customer_id);
  }
  return set.size;
}
function pedidosOf(r: RouteRow) {
  return (r.route_orders ?? []).length;
}
function valorOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.total_amount ?? 0);
  return total;
}
function pesoOf(r: RouteRow) {
  let total = 0;
  for (const ro of r.route_orders ?? []) total += Number(ro.orders?.weight ?? 0);
  return total;
}
function statusMapOf(r: RouteRow) {
  const m = new Map<string, Set<string>>();
  for (const ro of r.route_orders ?? []) {
    const o = ro.orders;
    if (!o) continue;
    const st = o.erp_status ?? "—";
    if (!m.has(st)) m.set(st, new Set());
    m.get(st)!.add(o.order_number ?? "");
  }
  return new Map(Array.from(m.entries()).map(([k, v]) => [k, v.size]));
}
function slugify(s: string): string {
  return (
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "rota"
  );
}

function StatusList({ map }: { map: Map<string, number> }) {
  const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (sorted.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div className="flex flex-col gap-0.5 text-xs">
      {sorted.map(([st, count]) => (
        <div key={st} className="flex items-center justify-between gap-3">
          <span className="font-medium">{st}</span>
          <span className="tabular-nums text-muted-foreground">{count}</span>
        </div>
      ))}
    </div>
  );
}

function FreightInput({
  route,
  estimate,
  tipo,
  bordero,
  isAdmin,
  mostrarConfirmar = false,
  onValorChange,
  onConfirmar,
}: {
  route: RouteRow;
  estimate: SimulacaoRota | null;
  tipo: TipoFrete | null;
  bordero: { total: number; comBordero: number; faturados: number };
  isAdmin: boolean;
  mostrarConfirmar?: boolean;
  onValorChange: (routeId: string, valor: number | null) => void;
  onConfirmar: (route: RouteRow, valor: number) => void;
}) {
  const qc = useQueryClient();
  const initial = Number(route.total_freight ?? 0);
  const isEstimate = tipo === "T" && initial <= 0 && estimate != null;
  const [value, setValue] = useState<string>(
    initial > 0 ? String(initial) : estimate ? String(estimate.total) : "",
  );
  const [estimated, setEstimated] = useState(isEstimate);
  const [salvando, setSalvando] = useState(false);

  const confirmado = route.frete_confirmado_em != null;
  // Somente rotas de fretista permitem digitar o valor do frete.
  // Enquanto o pagamento não for confirmado, o valor pode ser digitado/alterado.
  // Após a confirmação do pagamento o valor fica bloqueado para todos;
  // alterações passam pelo botão "Reabrir / Lançar adicional".
  const editable = tipo === "F" && !confirmado;

  const numero = Number(value.replace(",", "."));
  const valorNum = Number.isFinite(numero) ? numero : 0;
  // Só é possível confirmar o pagamento quando todos os pedidos tiverem borderô.
  const pendentes = Math.max(0, bordero.total - bordero.comBordero);
  const podeConfirmar =
    valorNum > 0 && bordero.total > 0 && pendentes === 0 && (!confirmado || isAdmin);

  // Grava o valor planejado ao sair do campo, sem criar pagamento.
  const salvarPlanejado = async () => {
    if (estimated || confirmado) return;
    const n = value.trim() === "" ? 0 : Number(value.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || Math.abs(n - initial) < 0.000001) return;
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("routes")
        .update({ total_freight: n })
        .eq("id", route.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["routes"] });
    } catch (e) {
      console.warn("[FreightInput] falhou ao gravar valor planejado:", e);
      toast.error("Não foi possível gravar o valor planejado. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const title = estimate
    ? `Estimativa calculada pela tabela de preço "${estimate.tabelaNome}" (${estimate.entregasCalculadas} de ${estimate.entregasTotal} entregas${estimate.parcial ? " — praça não identificada nas demais" : ""}).`
    : undefined;

  if (!editable) {
    if (!value && !confirmado) return <span className="text-muted-foreground">—</span>;
    return (
      <div className="flex flex-col items-end gap-1">
        <span
          className={`inline-flex items-center gap-1 tabular-nums ${estimated ? "italic text-amber-600" : ""}`}
          title={
            confirmado
              ? "Pagamento confirmado — valor bloqueado; use Reabrir / Lançar adicional"
              : estimated
                ? title
                : undefined
          }
        >
          {estimated && <Calculator className="h-3 w-3" />}
          {value
            ? Number(value).toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })
            : "—"}
        </span>
        {confirmado && (
          <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold text-emerald-600">
            Pgto confirmado
          </span>
        )}
        {confirmado && mostrarConfirmar && (
          <Button
            size="sm"
            variant="outline"
            className={`h-6 px-2 text-[11px] ${podeConfirmar ? "" : "cursor-not-allowed"}`}
            disabled={!podeConfirmar}
            title={
              !isAdmin
                ? "Apenas administradores podem reabrir ou lançar valores adicionais"
                : undefined
            }
            onClick={() => onConfirmar(route, valorNum)}
          >
            Reabrir / Lançar adicional
          </Button>
        )}
      </div>
    );
  }

  const precisaValor = !confirmado && valorNum <= 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1 justify-end">
        {estimated && (
          <span
            title={title}
            className="inline-flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-600"
          >
            <Calculator className="h-3 w-3" /> est.
          </span>
        )}
        <Input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value}
          title={estimated ? title : undefined}
          onChange={(e) => {
            setValue(e.target.value);
            setEstimated(false);
            const n = Number(e.target.value.replace(",", "."));
            onValorChange(route.id, Number.isFinite(n) && e.target.value !== "" ? n : null);
          }}
          onBlur={() => void salvarPlanejado()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          disabled={salvando}
          className={`h-7 w-28 text-right tabular-nums text-xs ${
            estimated
              ? "border-amber-500/40 bg-amber-500/10 italic text-amber-700"
              : precisaValor
                ? "border-amber-500/60 bg-amber-500/10"
                : ""
          }`}
          placeholder="0,00"
        />
      </span>
      {confirmado && (
        <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-1 py-0.5 text-[10px] font-semibold text-emerald-600">
          Pgto confirmado
        </span>
      )}
      {precisaValor && pendentes === 0 && (
        <span className="rounded border border-amber-500/30 bg-amber-500/15 px-1 py-0.5 text-[10px] font-semibold text-amber-600">
          Definir valor do frete
        </span>
      )}
      {mostrarConfirmar && (
        <>
          <Button
            size="sm"
            variant={confirmado ? "outline" : "default"}
            className={`h-6 px-2 text-[11px] ${
              podeConfirmar
                ? confirmado
                  ? ""
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
                : "cursor-not-allowed"
            }`}
            disabled={!podeConfirmar}
            title={
              pendentes > 0
                ? `Aguardando borderô de ${pendentes} pedido${pendentes === 1 ? "" : "s"} de ${bordero.total}`
                : confirmado && !isAdmin
                  ? "Apenas administradores podem reabrir ou lançar valores adicionais"
                  : undefined
            }
            onClick={() => onConfirmar(route, valorNum)}
          >
            {confirmado ? "Reabrir / Lançar adicional" : "Confirmar Pgto"}
          </Button>
          {pendentes > 0 && (
            <span className="text-[10px] text-muted-foreground">
              Aguardando borderô de {pendentes} pedido{pendentes === 1 ? "" : "s"} de{" "}
              {bordero.total}
            </span>
          )}
        </>
      )}
    </div>
  );
}



function DistanceCell({
  route,
  depot,
}: {
  route: RouteRow;
  depot: { lat: number; lng: number } | null;
}) {
  const compute = useServerFn(computeRoutePolyline);
  const qc = useQueryClient();
  const attempted = useRef(false);
  const [value, setValue] = useState<number | null>(() => {
    const v = route.total_distance_km;
    if (v == null) return null;
    const n = Number(v);
    return n > 0 ? n : null;
  });
  const [computing, setComputing] = useState(false);

  const stops = useMemo(() => {
    const ros = [...(route.route_orders ?? [])].sort(
      (a, b) => (a.stop_order ?? 0) - (b.stop_order ?? 0),
    );
    const pts: { lat: number; lng: number; orderNumber: string; customerName: string; kind: "new" }[] = [];
    for (const ro of ros) {
      const ordersRaw = ro.orders as unknown;
      const order = (Array.isArray(ordersRaw) ? ordersRaw[0] : ordersRaw) as
        | {
            order_number?: string | null;
            delivery_latitude?: number | string | null;
            delivery_longitude?: number | string | null;
          }
        | null
        | undefined;
      if (!order) continue;
      const coord = getOrderCoord({
        delivery_latitude: order.delivery_latitude,
        delivery_longitude: order.delivery_longitude,
      });
      if (!coord) continue;
      pts.push({
        lat: coord.lat,
        lng: coord.lng,
        orderNumber: order.order_number ?? "",
        customerName: "",
        kind: "new",
      });
    }
    return pts;
  }, [route]);

  useEffect(() => {
    if (value != null) return;
    if (attempted.current) return;
    if (stops.length < 1) return;

    const ordered = sequenceStops(stops, depot);
    const pathPoints = depot
      ? [depot, ...ordered.map((s) => ({ lat: s.lat, lng: s.lng }))]
      : ordered.map((s) => ({ lat: s.lat, lng: s.lng }));
    if (pathPoints.length < 2) return;

    attempted.current = true;
    setComputing(true);
    (async () => {
      const MAX = 25;
      let totalMeters = 0;
      try {
        for (let i = 0; i < pathPoints.length - 1; i += MAX - 1) {
          const segment = pathPoints.slice(i, i + MAX);
          const origin = segment[0];
          const destination = segment[segment.length - 1];
          const waypoints = segment.slice(1, -1);
          const result = await compute({ data: { origin, destination, waypoints } });
          totalMeters += result.distanceMeters ?? 0;
        }
        const km = totalMeters > 0 ? totalMeters / 1000 : 0;
        const rounded = Math.round(km * 100) / 100;
        setValue(rounded);
        await supabase
          .from("routes")
          .update({ total_distance_km: rounded })
          .eq("id", route.id);
        qc.invalidateQueries({ queryKey: ["routes"] });
      } catch (err) {
        console.warn("[DistanceCell] falhou:", err);
        attempted.current = false;
      } finally {
        setComputing(false);
      }
    })();
  }, [stops, depot, value, compute, qc, route.id]);



  const triggerRecalc = () => {
    attempted.current = false;
    setValue(null);
  };

  return (
    <div className="inline-flex items-center gap-1 justify-end">
      {computing ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : value != null ? (
        <span>{value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      <button
        type="button"
        onClick={triggerRecalc}
        disabled={computing}
        title="Recalcular distância"
        className="text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}


export function RotasView({
  titulo,
  descricao,
  mostrarAcoesDeRota = false,
  permitirConfirmacao = false,
  filtro,
  mensagemVazia = "Nenhuma rota criada.",
  tableKey,
}: RotasViewProps) {
  const qc = useQueryClient();
  const { cidadeCliente } = useClientesErp();
  const { role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [filteredData, setFilteredData] = useState<RouteRow[] | undefined>();
  const [editRoute, setEditRoute] = useState<RouteRow | null>(null);
  const [editCodErp, setEditCodErp] = useState<string | null>(null);
  const [editResponsavel, setEditResponsavel] = useState<ResponsavelErp | null>(null);
  const [freteEditado, setFreteEditado] = useState<Record<string, number | null>>({});
  const [pagamento, setPagamento] = useState<{ rota: RouteRow; valor: number } | null>(null);

  const depotQ = useQuery({
    queryKey: ["company_settings", "depot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("depot_latitude, depot_longitude")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (data?.depot_latitude != null && data?.depot_longitude != null) {
        return { lat: Number(data.depot_latitude), lng: Number(data.depot_longitude) };
      }
      return null;
    },
  });
  const depot = depotQ.data ?? null;



  const { data, isLoading, error: routesError } = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(
          "id,code,erp_route_id,erp_status,route_date,status,total_freight,total_distance_km,driver_name,notes,frete_confirmado_em,bordero_emitido_em,freight_carriers(full_name,vehicle_plate,transportadoras(id,cod_erp)),route_orders(stop_order,orders(customer_id,erp_cod_cliente,order_number,total_amount,weight,erp_status,bordero,delivery_latitude,delivery_longitude))",
        );
      if (error) throw error;
      const rows = ((data ?? []) as unknown as RouteRow[]).filter(
        (r) => (r.route_orders ?? []).length > 0,
      );
      rows.sort((a, b) => {
        const d = routeDateSortKey(a.route_date).localeCompare(
          routeDateSortKey(b.route_date),
        );
        if (d !== 0) return d;
        return nomeRotaOf(a).localeCompare(nomeRotaOf(b), undefined, {
          sensitivity: "base",
        });
      });
      return rows;
    },
  });

  const tabelasQ = useQuery({
    queryKey: ["tabelas-frete-simulacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete")
        .select("*, tabelas_preco_frete_faixas(*), tabelas_preco_frete_rotas(*)")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as unknown as TabelaSim[];
    },
  });

  const vinculosQ = useQuery({
    queryKey: ["tabelas-frete-vinculos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tabelas_preco_frete_transportadoras")
        .select("tabela_id, transportadora_id");
      if (error) throw error;
      return (data ?? []) as { tabela_id: string; transportadora_id: string }[];
    },
  });


  const transportadorasQ = useQuery({
    queryKey: ["transportadoras-simulacao"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transportadoras")
        .select("id, razao_social, cod_erp")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as TransportadoraLite[];
    },
  });

  /** Transportadora resolvida por rota (vínculo direto ou casamento por nome). */
  const transpPorRota = useMemo(() => {
    const map = new Map<string, TransportadoraLite>();
    const lista = transportadorasQ.data ?? [];
    for (const r of data ?? []) {
      const t = resolveTransportadora(r, lista);
      if (t) map.set(r.id, t);
    }
    return map;
  }, [data, transportadorasQ.data]);

  const listarResponsaveis = useServerFn(listarResponsaveisErp);
  const responsaveisQ = useQuery({
    queryKey: ["responsaveis-erp"],
    queryFn: () => listarResponsaveis(),
    staleTime: 30 * 60 * 1000,
  });
  const responsaveisLocaisQ = useQuery({
    queryKey: ["erp-responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_responsaveis")
        .select("cod_erp,razao_social,natureza,tipo_frete")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as { cod_erp: string; razao_social: string | null; natureza: string | null; tipo_frete: TipoFrete | null }[];
    },
    staleTime: 30 * 60 * 1000,
  });

  /** Códigos de responsável (COD_FRT_TRP) direto do ERP, por ID de rota. */
  const listarCodsRotas = useServerFn(listarResponsaveisDeRotasErp);
  const idsRotaErp = useMemo(
    () =>
      Array.from(
        new Set(
          (data ?? [])
            .map((r) => Number(r.erp_route_id))
            .filter((v) => Number.isFinite(v) && v > 0),
        ),
      ).sort((a, b) => a - b),
    [data],
  );
  const codsRotaQ = useQuery({
    queryKey: ["rotas-responsaveis-erp", idsRotaErp],
    queryFn: () => listarCodsRotas({ data: { idsRota: idsRotaErp } }),
    enabled: idsRotaErp.length > 0,
    staleTime: 60 * 1000,
  });

  /** Código do responsável efetivamente usado por rota (ERP → local). */
  const codResponsavelPorRota = useMemo(() => {
    const map = new Map<string, string>();
    const codsErp = codsRotaQ.data ?? {};
    for (const r of data ?? []) {
      const codRota = r.erp_route_id ? codsErp[String(Number(r.erp_route_id))] : undefined;
      const cod = codRota ?? transpPorRota.get(r.id)?.cod_erp ?? null;
      if (cod && String(cod).trim()) map.set(r.id, String(cod).trim());
    }
    return map;
  }, [data, codsRotaQ.data, transpPorRota]);

  const sincronizarAusentes = useServerFn(sincronizarResponsaveisPorCodigo);
  const codigosLocais = useMemo(
    () => new Set((responsaveisLocaisQ.data ?? []).map((item) => normalizaCod(item.cod_erp))),
    [responsaveisLocaisQ.data],
  );
  const codigosAusentes = useMemo(
    () => Array.from(new Set(Array.from(codResponsavelPorRota.values()).filter((cod) => !codigosLocais.has(normalizaCod(cod))))),
    [codResponsavelPorRota, codigosLocais],
  );
  // Códigos já tentados nesta sessão: sem isso, um código que o ERP não resolve
  // mantém `codigosAusentes` preenchido e o efeito repete a sincronização em loop.
  const codsTentadosRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (responsaveisLocaisQ.isFetching) return;
    const pendentes = codigosAusentes.filter((cod) => !codsTentadosRef.current.has(normalizaCod(cod)));
    if (pendentes.length === 0) return;
    for (const cod of pendentes) codsTentadosRef.current.add(normalizaCod(cod));
    sincronizarAusentes({ data: { cods: pendentes } })
      .then(() => qc.invalidateQueries({ queryKey: ["erp-responsaveis"] }))
      .catch(() => undefined);
  }, [codigosAusentes, responsaveisLocaisQ.isFetching, sincronizarAusentes, qc]);


  const responsavelPorRota = useMemo(() => {
    const map = new Map<string, ResponsavelErp>();
    const responsaveis = responsaveisQ.data ?? [];
    const locais = (responsaveisLocaisQ.data ?? [])
      .filter((item): item is typeof item & { tipo_frete: TipoFrete } => Boolean(item.tipo_frete))
      .map((item): ResponsavelErp => ({
        razaoSocial: item.razao_social ?? `Código ${item.cod_erp}`,
        codErp: item.cod_erp,
        tipoFrete: item.tipo_frete,
      }));
    const porCodigo = new Map(locais.map((item) => [normalizaCod(item.codErp), item]));
    for (const item of responsaveis) porCodigo.set(normalizaCod(item.codErp), item);
    for (const r of data ?? []) {
      const cod = codResponsavelPorRota.get(r.id);
      const local = cod ? porCodigo.get(normalizaCod(cod)) : undefined;
      if (local) {
        map.set(r.id, local);
        continue;
      }
      const nome = normalizaNome(r.driver_name ?? r.freight_carriers?.full_name ?? "");
      // Sem nome na rota não dá para adivinhar: cadastros vazios (ex.: ".")
      // casavam com qualquer rota sem motorista e geravam fretista fantasma.
      if (nome.length < 4) continue;
      const porNome = responsaveis.find((item) => {
        const alvo = normalizaNome(item.razaoSocial);
        if (alvo.length < 4) return false;
        return alvo === nome || alvo.startsWith(nome) || nome.startsWith(alvo);
      });
      if (porNome) map.set(r.id, porNome);

    }
    return map;
  }, [data, responsaveisQ.data, responsaveisLocaisQ.data, codResponsavelPorRota]);

  /** Natureza bruta do responsável da rota, lida do espelho local do ERP. */
  const naturezaDaRota = (r: RouteRow) => {
    const cod = codResponsavelPorRota.get(r.id);
    if (!cod) return null;
    const local = (responsaveisLocaisQ.data ?? []).find(
      (item) => normalizaCod(item.cod_erp) === normalizaCod(cod),
    );
    if (!local?.natureza) return null;
    return { codErp: local.cod_erp, natureza: local.natureza };
  };

  const tipoFreteOf = (r: RouteRow): TipoFrete | null =>
    responsavelPorRota.get(r.id)?.tipoFrete ?? null;

  const estimativas = useMemo(() => {
    const map = new Map<string, SimulacaoRota>();
    const tabelas = tabelasQ.data ?? [];
    const vinculos = vinculosQ.data ?? [];
    if (!tabelas.length) return map;
    for (const r of data ?? []) {
      if (tipoFreteOf(r) !== "T") continue;
      const transportadoraId = transpPorRota.get(r.id)?.id;
      if (!transportadoraId) continue;
      const tabela = tabelaVigenteDaTransportadora(tabelas, vinculos, transportadoraId);
      if (!tabela) continue;

      // Uma entrega por cliente da rota: soma peso e valor dos pedidos.
      const porCliente = new Map<
        string,
        { peso: number; valorMercadoria: number; municipio: string | null }
      >();
      for (const ro of r.route_orders ?? []) {
        const o = ro.orders;
        const chaveCliente = o?.customer_id ?? o?.erp_cod_cliente ?? null;
        if (!chaveCliente) continue;
        // A praça da tabela de frete é resolvida pelo município do cliente
        // (espelho local do ERP); sem ele, nenhuma linha da tabela casa.
        const atual = porCliente.get(chaveCliente) ?? {
          peso: 0,
          valorMercadoria: 0,
          municipio: cidadeCliente(o?.erp_cod_cliente ?? null),
        };
        if (!atual.municipio) atual.municipio = cidadeCliente(o?.erp_cod_cliente ?? null);
        atual.peso += Number(o?.weight ?? 0);
        atual.valorMercadoria += Number(o?.total_amount ?? 0);
        porCliente.set(chaveCliente, atual);
      }
      const sim = simularRota(tabela, Array.from(porCliente.values()));
      if (sim) map.set(r.id, sim);
    }
    return map;
    // `tipoFreteOf` depende das consultas ao ERP (naturezas/responsáveis):
    // sem elas nas dependências, a estimativa ficaria vazia após o carregamento.
  }, [
    data,
    tabelasQ.data,
    vinculosQ.data,
    transpPorRota,
    naturezasQ.data,
    responsavelPorRota,
    codResponsavelPorRota,
    cidadeCliente,
  ]);

  /** Borderô por pedido, vindo do espelho de entregas do ERP. */
  const pedidosDaTela = useMemo(() => {
    const set = new Set<string>();
    for (const r of data ?? []) {
      for (const ro of r.route_orders ?? []) {
        const cod = (ro.orders?.order_number ?? "").trim();
        if (cod) set.add(cod);
      }
    }
    return Array.from(set).sort();
  }, [data]);

  const borderosQ = useQuery({
    queryKey: ["rotas-borderos", pedidosDaTela.length],
    enabled: pedidosDaTela.length > 0,
    queryFn: async () => {
      const map = new Map<string, { bordero: string | null; nf: string | null }>();
      for (let i = 0; i < pedidosDaTela.length; i += 200) {
        const lote = pedidosDaTela.slice(i, i + 200);
        const { data: rows, error } = await supabase
          .from("entregas_abertas")
          .select("cod_pedido, bordero, nro_nf")
          .in("cod_pedido", lote);
        if (error) throw error;
        for (const row of (rows ?? []) as {
          cod_pedido: string;
          bordero: string | null;
          nro_nf: string | null;
        }[]) {
          const b = (row.bordero ?? "").trim() || null;
          const nf = (row.nro_nf ?? "").trim() || null;
          const atual = map.get(row.cod_pedido);
          map.set(row.cod_pedido, {
            bordero: atual?.bordero ?? b,
            nf: atual?.nf ?? nf,
          });
        }
      }
      return map;
    },
  });

  const borderoDaRota = useMemo(() => {
    const map = borderosQ.data;
    return (r: RouteRow) => {
      const pedidos = (r.route_orders ?? [])
        .map((ro) => ({
          order: (ro.orders?.order_number ?? "").trim(),
          status: (ro.orders?.erp_status ?? "").trim().toUpperCase(),
          bordero: (ro.orders?.bordero ?? "").trim(),
        }))
        .filter((p) => p.order);
      const unicos = Array.from(new Set(pedidos.map((p) => p.order)));
      const statusPorPedido = new Map<string, string[]>();
      const borderoPorPedido = new Map<string, string>();
      for (const p of pedidos) {
        const arr = statusPorPedido.get(p.order) ?? [];
        arr.push(p.status);
        statusPorPedido.set(p.order, arr);
        if (p.bordero && !borderoPorPedido.get(p.order)) borderoPorPedido.set(p.order, p.bordero);
      }
      // Borderô vem do pedido (gravado na sincronização) ou do espelho de entregas.
      const comBordero = unicos.filter(
        (p) => borderoPorPedido.get(p) || map?.get(p)?.bordero,
      ).length;
      const faturados = unicos.filter((p) => {
        const nf = map?.get(p)?.nf;
        const statusList = statusPorPedido.get(p) ?? [];
        const faturadoPeloStatus = statusList.some((s) => s.includes("FATURADO"));
        return !!nf || faturadoPeloStatus || !!borderoPorPedido.get(p);
      }).length;
      return { total: unicos.length, comBordero, faturados };
    };
  }, [borderosQ.data]);

  /** Frete informado; na ausência, a estimativa da tabela da transportadora. */
  const freteOf = useMemo(
    () => (r: RouteRow) => {
      const editado = freteEditado[r.id];
      if (editado != null) return editado;
      return Number(r.total_freight ?? 0) > 0
        ? Number(r.total_freight)
        : (estimativas.get(r.id)?.total ?? 0);
    },
    [estimativas, freteEditado],
  );


  const columns = useMemo<ColumnDef<RouteRow>[]>(

    () => [
      {
        id: "erp_route_id",
        header: "ID",
        pinFirst: true,
        sortable: false,
        accessor: (r) => r.erp_route_id ?? "",
        render: (r) =>
          r.erp_route_id ? (
            <span className="font-semibold tabular-nums">ID {r.erp_route_id}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "route_date",
        header: "Data planejada",
        sortable: false,
        accessor: (r) => r.route_date,
        render: (r) => (
          <span className="text-primary">
            {formatRouteDate(r.route_date)}
          </span>
        ),
      },
      {
        id: "nome_rota",
        header: "Nome da rota",
        sortable: false,
        accessor: (r) => nomeRotaOf(r),
      },
      {
        id: "motorista",
        header: "Fret / Transp",
        sortable: false,
        accessor: (r) =>
          motoristaOf(
            r,
            codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp,
            responsavelPorRota.get(r.id),
          ),
        render: (r) =>
          motoristaOf(
            r,
            codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp,
            responsavelPorRota.get(r.id),
          ) || <span className="text-muted-foreground">—</span>,
      },
      {
        id: "tipo_frete",
        header: "Tipo",
        sortable: false,
        pinAfter: "motorista",
        align: "center",

        accessor: (r) => tipoFreteOf(r) ?? "",
        render: (r) => {
          const tipo = tipoFreteOf(r);
          if (tipo) {
            return (
              <span
                title={TIPO_FRETE_LABEL[tipo]}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold ${TIPO_FRETE_TONE[tipo]}`}
              >
                {tipo}
              </span>
            );
          }
          const nat = naturezaDaRota(r);
          if (nat) {
            return (
              <span
                title={`Natureza ${nat.natureza || "?"} no ERP (código ${nat.codErp})`}
                className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/15 px-1 text-[10px] font-bold text-amber-600"
              >
                {nat.natureza || "?"}
              </span>
            );
          }
          const carregando =
            codsRotaQ.isFetching || naturezasQ.isFetching || responsaveisQ.isFetching || responsaveisLocaisQ.isFetching;
          if (carregando) return <span className="text-muted-foreground">…</span>;
          const erro = codsRotaQ.error ?? naturezasQ.error ?? responsaveisQ.error;
          if (erro) {
            return (
              <span
                title={`Falha ao consultar o ERP: ${(erro as Error).message}`}
                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-xs font-bold text-destructive"
              >
                !
              </span>
            );
          }
          const cod = codResponsavelPorRota.get(r.id);
          return (
            <span
              className="text-muted-foreground"
              title={cod ? `Código ${cod} não identificado no ERP` : "Responsável sem código no ERP"}
            >
              —
            </span>
          );
        },
      },
      {
        id: "paradas",
        header: "Qtd Entregas",
        sortable: false,
        align: "right",
        accessor: (r) => paradasOf(r),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {rows.reduce((s, r) => s + paradasOf(r), 0)}
          </span>
        ),
      },
      {
        id: "valor_total",
        header: "Valor total",
        sortable: false,
        align: "right",
        accessor: (r) => valorOf(r),
        render: (r) => currencyFmt.format(valorOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + valorOf(r), 0))}
          </span>
        ),
      },
      {
        id: "peso_total",
        header: "Peso total (kg)",
        sortable: false,
        align: "right",
        accessor: (r) => pesoOf(r),
        render: (r) => weightFmt.format(pesoOf(r)),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {weightFmt.format(rows.reduce((s, r) => s + pesoOf(r), 0))}
          </span>
        ),
      },
      {
        id: "total_distance_km",
        header: "Distância (km)",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => Number(r.total_distance_km ?? 0),
        render: (r) => (
          <span onClick={(e) => e.stopPropagation()}>
            <DistanceCell route={r} depot={depot} />
          </span>
        ),
        className: "tabular-nums text-xs",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {rows
              .reduce((s, r) => s + Number(r.total_distance_km ?? 0), 0)
              .toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
          </span>
        ),
      },
      {
        id: "total_freight",
        header: "Frete (R$)",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => freteOf(r),
        render: (r) => (
          <span onClick={(e) => e.stopPropagation()}>
            <FreightInput
              key={`${r.id}-${r.total_freight ?? 0}-${estimativas.get(r.id)?.total ?? 0}-${tipoFreteOf(r) ?? ""}`}
              route={r}
              estimate={estimativas.get(r.id) ?? null}
              tipo={tipoFreteOf(r)}
              bordero={borderoDaRota(r)}
              isAdmin={role === "adm"}
              mostrarConfirmar={permitirConfirmacao}
              onValorChange={(id, v) =>
                setFreteEditado((prev) => ({ ...prev, [id]: v }))
              }
              onConfirmar={(rota, valor) => setPagamento({ rota, valor })}
            />
          </span>
        ),
        className: "tabular-nums",
        aggregate: (rows) => (
          <span className="tabular-nums">
            {currencyFmt.format(rows.reduce((s, r) => s + freteOf(r), 0))}
          </span>
        ),
      },

      {
        id: "freight_pct",
        header: "% Frete",
        sortable: false,
        align: "right",
        filterable: false,
        accessor: (r) => {
          const v = valorOf(r);
          return v > 0 ? (freteOf(r) / v) * 100 : 0;
        },
        render: (r) => {
          const v = valorOf(r);
          const f = freteOf(r);
          if (v <= 0 || f <= 0) return <span className="text-muted-foreground">—</span>;
          const est = Number(r.total_freight ?? 0) <= 0;
          return (
            <span className={est ? "italic text-amber-600" : undefined} title={est ? "Baseado na estimativa da tabela de preço" : undefined}>
              {((f / v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
            </span>
          );
        },
        className: "tabular-nums text-xs",
        aggregate: (rows) => {
          const v = rows.reduce((s, r) => s + valorOf(r), 0);
          const f = rows.reduce((s, r) => s + freteOf(r), 0);
          if (v <= 0 || f <= 0) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="tabular-nums">
              {((f / v) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%
            </span>
          );
        },

      },
      {

        id: "pedidos_status",
        header: "Pedidos por status",
        sortable: false,
        filterable: false,
        accessor: (r) =>
          Array.from(statusMapOf(r).keys()).join(", "),
        render: (r) => <StatusList map={statusMapOf(r)} />,
        aggregate: (rows) => {
          const agg = new Map<string, number>();
          for (const r of rows) {
            for (const [st, c] of statusMapOf(r)) {
              agg.set(st, (agg.get(st) ?? 0) + c);
            }
          }
          return <StatusList map={agg} />;
        },
      },
      {
        id: "status",
        header: "Status",
        sortable: false,
        defaultVisible: false,
        accessor: (r) => (r.bordero_emitido_em ? "Borderô emitido" : ROUTE_STATUS_LABEL[r.status]),
        render: (r) => (
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
              r.bordero_emitido_em
                ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
                : ROUTE_STATUS_TONE[r.status]
            }`}
          >
            {r.bordero_emitido_em ? "Borderô emitido" : ROUTE_STATUS_LABEL[r.status]}
          </span>
        ),
      },
      {
        id: "acoes",
        header: "",
        hideOnCard: true,
        sortable: false,
        align: "right",
        filterable: false,
        accessor: () => "",
        render: (r) =>
          r.erp_route_id ? (
            <button
              type="button"
              title="Editar rota"
              className="inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setEditCodErp(codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp ?? null);
                setEditResponsavel(responsavelPorRota.get(r.id) ?? null);
                setEditRoute(r);
              }}
            >
              <Pencil className="h-4 w-4" />
            </button>
          ) : null,
      },
    ],
    [
      depot,
      estimativas,
      freteOf,
      borderoDaRota,
      role,
      permitirConfirmacao,
      responsavelPorRota,
      transpPorRota,
      codResponsavelPorRota,
      naturezasQ.data,
      naturezasQ.isFetching,
      naturezasQ.error,
      codsRotaQ.isFetching,
      codsRotaQ.error,
      responsaveisQ.isFetching,
      responsaveisQ.error,
      responsaveisLocaisQ.data,
    ],
  );

  /** Rotas exibidas após o filtro específico da tela. */
  const rotasVisiveis = useMemo(() => {
    const rows = data ?? [];
    if (!filtro) return rows;
    return rows.filter((r) => filtro(r, { bordero: borderoDaRota(r) }));
  }, [data, filtro, borderoDaRota]);

  /** Rotas de fretista com borderô completo e ainda sem pagamento confirmado. */
  const aguardandoValor = useMemo(() => {
    const rows = filteredData ?? rotasVisiveis;
    return rows.filter((r) => {
      if (tipoFreteOf(r) !== "F") return false;
      if (r.frete_confirmado_em) return false;
      const b = borderoDaRota(r);
      if (b.total === 0 || b.comBordero < b.total) return false;
      const v = freteEditado[r.id] ?? Number(r.total_freight ?? 0);
      return !(Number(v) > 0);
    }).length;
  }, [filteredData, rotasVisiveis, tipoFreteOf, borderoDaRota, freteEditado]);



  const totals = useMemo(() => {
    const rows = filteredData ?? rotasVisiveis;
    return {
      merchandise: rows.reduce((s, r) => s + valorOf(r), 0),
      weight: rows.reduce((s, r) => s + pesoOf(r), 0),
      orders: rows.reduce((s, r) => s + pedidosOf(r), 0),
      stops: rows.reduce((s, r) => s + paradasOf(r), 0),
    };
  }, [filteredData, rotasVisiveis]);

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{titulo}</h1>
            <p className="text-muted-foreground text-sm">{descricao}</p>
          </div>
          {mostrarAcoesDeRota && (
            <div className="flex w-full flex-wrap items-start gap-2 sm:w-auto">
              <ErpSyncButton label="Atualizar rotas" lastSyncPrefix="Atualizado" />
              <Button onClick={() => setOpen(true)} className="flex-1 sm:flex-none">
                <Plus className="h-4 w-4 mr-1" /> Nova rota
              </Button>
            </div>
          )}
        </div>

        {aguardandoValor > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
            {aguardandoValor} rota(s) de fretista com borderô completo aguardando a definição do
            valor do frete.
          </div>
        )}


        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Valor total das mercadorias</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {currencyFmt.format(totals.merchandise)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Peso total</CardTitle>
              <Weight className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {weightFmt.format(totals.weight)} kg
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Quantidade de pedidos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {totals.orders.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Quantidade de entregas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums break-words">
                {totals.stops.toLocaleString("pt-BR")}
              </div>
            </CardContent>
          </Card>
        </div>

        {routesError ? (
          <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Não foi possível carregar as rotas:{" "}
            {(routesError as Error).message}
          </div>
        ) : null}

        <DataTable
          tableKey={tableKey}
          columns={columns}
          data={rotasVisiveis}
          isLoading={isLoading}
          rowKey={(r) => r.id}
          emptyMessage={mensagemVazia}
          onFilteredChange={setFilteredData}
          onRowClick={(r) =>
            navigate({ to: "/rotas/$routeId", params: { routeId: r.id } })
          }
          cardHeaderAction={(r) =>
            r.erp_route_id ? (
              <button
                type="button"
                title="Editar rota"
                aria-label="Editar rota"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditCodErp(codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp ?? null);
                  setEditResponsavel(responsavelPorRota.get(r.id) ?? null);
                  setEditRoute(r);
                }}
              >
                <Pencil className="h-5 w-5" />
              </button>
            ) : null
          }
          groupBy={{
            id: "route_date",
            accessor: (r) => r.route_date,
            label: (key, rows) => {
              const valor = rows.reduce((s, r) => s + valorOf(r), 0);
              const peso = rows.reduce((s, r) => s + pesoOf(r), 0);
              return (
                <>
                  <span className="hidden sm:inline">{formatRouteDate(key)}</span>
                  <span className="inline sm:hidden">
                    Total {formatRouteDate(key)} · {currencyFmt.format(valor)} · {weightFmt.format(peso)} kg
                  </span>
                </>
              );
            },
          }}
        />
      </div>

      {mostrarAcoesDeRota && (
        <NewRouteDialog
          open={open}
          onOpenChange={setOpen}
          onCreated={() => qc.invalidateQueries({ queryKey: ["routes"] })}
        />
      )}
      <RouteEditDialog
        route={
          editRoute
            ? {
                id: editRoute.id,
                code: editRoute.code,
                nomeRota: nomeRotaOf(editRoute),
                route_date: editRoute.route_date,
                notes: editRoute.notes,
                driver_name: editRoute.driver_name,
                erp_route_id: editRoute.erp_route_id,
                erp_status: editRoute.erp_status,
              }
            : null
        }
        open={!!editRoute}
        onOpenChange={(o) => {
          if (!o) setEditRoute(null);
        }}
        initialCodErp={editCodErp}
        initialResponsavel={editResponsavel}
        onSuccess={() => {
          qc.invalidateQueries({ queryKey: ["routes"] });
          setEditRoute(null);
        }}
      />
      <PagamentoRotaDialog
        routeId={pagamento?.rota.id ?? null}
        rotulo={
          pagamento
            ? `${pagamento.rota.erp_route_id ? `ID ${pagamento.rota.erp_route_id} · ` : ""}${nomeRotaOf(pagamento.rota)}`
            : ""
        }
        valor={pagamento?.valor ?? 0}
        isAdmin={role === "adm"}
        jaConfirmado={!!pagamento?.rota.frete_confirmado_em}
        open={!!pagamento}
        onOpenChange={(o) => {
          if (!o) setPagamento(null);
        }}
      />
    </AppShell>
  );
}

function NewRouteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: () => void;
}) {
  const [routeDate, setRouteDate] = useState(new Date().toISOString().slice(0, 10));
  const [routeName, setRouteName] = useState("");
  const [driverName, setDriverName] = useState("");
  const [freight, setFreight] = useState("0");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      if (!routeName.trim()) throw new Error("Informe o nome da rota");
      const code = `${slugify(routeName)}-${routeDate.replace(/-/g, "")}`;
      const { error } = await supabase.from("routes").insert({
        code,
        route_date: routeDate,
        driver_name: driverName.trim() || null,
        total_freight: Number(freight || 0),
        notes: notes.trim() ? notes : `Rota ${routeName.trim()}`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota criada");
      onCreated();
      onOpenChange(false);
      setRouteName("");
      setDriverName("");
      setFreight("0");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova rota</DialogTitle>
          <DialogDescription>
            Crie a rota e, na próxima tela, atribua pedidos faturados.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Nome da rota *</Label>
            <Input
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Ex: Rota Centro"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Data planejada de saída *</Label>
            <Input type="date" value={routeDate} onChange={(e) => setRouteDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Frete total (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={freight}
              onChange={(e) => setFreight(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Motorista</Label>
            <Input
              value={driverName}
              onChange={(e) => setDriverName(e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar rota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
