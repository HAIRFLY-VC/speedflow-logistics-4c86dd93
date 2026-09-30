import { PedidoCodigo } from "@/components/orders/PedidoCodigo";
import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/toast";
import { Loader2, MessageSquareText, RefreshCw, Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { MultiFiltro, type OpcaoFiltro } from "@/components/pedidos-sem-rota/MultiFiltro";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/central/client";
import { localizarLocalidades } from "@/lib/geo-localidades.functions";
import { useClientesErp } from "@/hooks/useClientesErp";
import { atribuirPedidosARota } from "@/lib/pedidos-sem-rota.functions";
import {
  listarPedidosDetalheRota,
  listarResponsaveisErp,
  type PedidoDetalheRota,
} from "@/lib/rota-erp.functions";
import { pedidosSemRotaQueryOptions } from "@/lib/pedidos-sem-rota.query";

export const Route = createFileRoute("/_authenticated/pedidos-sem-rota")({
  component: PedidosSemRotaPage,
  head: () => ({
    meta: [
      { title: "Pedidos sem rota | Speedflow" },
      {
        name: "description",
        content:
          "Selecione pedidos sem previsão de expedição e atribua a uma rota nova ou existente.",
      },
      { property: "og:title", content: "Pedidos sem rota | Speedflow" },
      {
        property: "og:description",
        content: "Roteirize pelo celular os pedidos que ainda não têm rota definida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const dataBr = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
};

function Observacao({ label, texto }: { label: string; texto: string | null }) {
  if (!texto) return <span className="text-muted-foreground/40">—</span>;
  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-primary"
          aria-label={`Ver ${label}`}
          title={`Ver ${label}`}
        >
          <MessageSquareText className="h-3.5 w-3.5" />
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 max-w-[90vw] whitespace-pre-wrap break-words p-3 text-xs">
        <p className="mb-1 font-semibold">{label}</p>
        {texto}
      </HoverCardContent>
    </HoverCard>
  );
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function PedidosSemRotaPage() {
  const qc = useQueryClient();
  const { nomeCliente, cidadeCliente, bairroCliente, ufCliente, clientes: clientesErp } = useClientesErp();

  const pedidosQ = useQuery(pedidosSemRotaQueryOptions());

  const depositoQ = useQuery({
    queryKey: ["deposito-coords"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("depot_latitude, depot_longitude")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      const lat = Number(data?.depot_latitude);
      const lng = Number(data?.depot_longitude);
      return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
    },
    staleTime: 30 * 60 * 1000,
  });

  const geoQ = useQuery({
    queryKey: ["customer-geo-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_geo")
        .select("cod_cliente, latitude, longitude");
      if (error) throw error;
      return (data ?? []) as {
        cod_cliente: string;
        latitude: number | null;
        longitude: number | null;
      }[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const rotasQ = useQuery({
    queryKey: ["rotas-planejadas-sem-rota"],
    queryFn: async () => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("routes")
        .select("id, code, notes, route_date, driver_name, erp_route_id")
        .eq("status", "planejada")
        .gte("route_date", hoje)
        .lt("route_date", "3000-01-01")
        .order("route_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const carregarResponsaveis = useServerFn(listarResponsaveisErp);
  const responsaveisQ = useQuery({
    queryKey: ["erp-responsaveis-cadastro"],
    queryFn: () => carregarResponsaveis(),
    staleTime: 30 * 60 * 1000,
  });

  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState<string[]>([]);
  const [cidade, setCidade] = useState<string[]>([]);
  const [bairro, setBairro] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<string[]>([]);
  const [filial, setFilial] = useState<string[]>([]);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [painelAberto, setPainelAberto] = useState(false);

  const numerosPedidos = useMemo(
    () =>
      Array.from(
        new Set(
          (pedidosQ.data ?? [])
            .map((p) => String(p.erp_id ?? p.order_number ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [pedidosQ.data],
  );
  const buscarDetalhes = useServerFn(listarPedidosDetalheRota);
  const detalhesQ = useQuery({
    queryKey: ["pedidos-sem-rota-detalhes", numerosPedidos],
    queryFn: async () => {
      const detalhes: PedidoDetalheRota[] = [];
      for (let inicio = 0; inicio < numerosPedidos.length; inicio += 1000) {
        detalhes.push(
          ...(await buscarDetalhes({ data: { pedidos: numerosPedidos.slice(inicio, inicio + 1000) } })),
        );
      }
      return detalhes;
    },
    enabled: numerosPedidos.length > 0,
    staleTime: 60_000,
  });

  const linhas = useMemo(() => {
    const detalhePorPedido = new Map((detalhesQ.data ?? []).map((d) => [d.pedido, d]));
    return (pedidosQ.data ?? []).map((p) => {
      const numero = String(p.erp_id ?? p.order_number ?? "").trim();
      const detalhe = detalhePorPedido.get(numero);
      const codCliente = detalhe?.codCliente ?? (p.erp_cod_cliente ? String(p.erp_cod_cliente).trim() : "");
      return {
        id: p.id,
        numero,
        codCliente,
        cliente: detalhe?.cliente ?? nomeCliente(codCliente),
        cidade: detalhe?.cidade ?? cidadeCliente(codCliente) ?? "",
        bairro: detalhe?.bairro ?? bairroCliente(codCliente) ?? "",
        uf: detalhe?.uf ?? ufCliente(codCliente) ?? "",
        agenda: detalhe?.codAgenda ?? (p.cod_agenda == null ? "" : String(p.cod_agenda)),
        filial: detalhe?.codFilial ?? (p.cod_filial ? String(p.cod_filial) : ""),
        valor: Number(p.total_amount ?? 0),
        peso: Number(p.weight ?? 0),
        status: detalhe?.status ?? null,
        nf: detalhe?.nf ?? null,
        codVendedor: detalhe?.codVendedor ?? null,
        vendedor: detalhe?.vendedor ?? null,
        dtPedido: detalhe?.dtPedido ?? null,
        dtAgenda: detalhe?.dtAgenda ?? null,
        obs: detalhe?.obs ?? null,
        obsLogist: detalhe?.obsLogist ?? null,
        infCmp: detalhe?.infCmp ?? null,
        deliveryLatitude: p.delivery_latitude,
        deliveryLongitude: p.delivery_longitude,
      };
    });
  }, [pedidosQ.data, detalhesQ.data, nomeCliente, cidadeCliente, bairroCliente, ufCliente]);

  // Localidades (bairro/cidade) de clientes sem endereço exato → Google Maps.
  const localizar = useServerFn(localizarLocalidades);
  const localidadesPendentes = useMemo(() => {
    const comGeo = new Set((geoQ.data ?? []).map((g) => String(g.cod_cliente).trim()));
    const mapa = new Map<string, { uf: string; cidade: string; bairro: string }>();
    for (const l of linhas) {
      if (l.deliveryLatitude != null && l.deliveryLongitude != null) continue;
      if (l.codCliente && comGeo.has(l.codCliente)) continue;
      if (!l.uf || !l.cidade) continue;
      const up = (s: string) => s.trim().toUpperCase();
      for (const bairro of l.bairro ? [l.bairro, ""] : [""]) {
        const item = { uf: up(l.uf), cidade: up(l.cidade), bairro: up(bairro) };
        mapa.set(`${item.uf}|${item.cidade}|${item.bairro}`, item);
      }
    }
    return [...mapa.values()].sort((a, b) =>
      `${a.uf}|${a.cidade}|${a.bairro}`.localeCompare(`${b.uf}|${b.cidade}|${b.bairro}`),
    );
  }, [linhas, geoQ.data]);
  const localidadesQ = useQuery({
    queryKey: ["geo-localidades", localidadesPendentes],
    queryFn: () => localizar({ data: { localidades: localidadesPendentes } }),
    enabled: localidadesPendentes.length > 0,
    staleTime: 10 * 60_000,
  });

  // Agrupa pedidos por cliente e ordena os clientes pela distância até o CD.
  const grupos = useMemo(() => {
    const geoPorCliente = new Map<string, { lat: number; lng: number }>();
    for (const g of geoQ.data ?? []) {
      const lat = Number(g.latitude);
      const lng = Number(g.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        geoPorCliente.set(String(g.cod_cliente).trim(), { lat, lng });
      }
    }
    const deposito = depositoQ.data ?? null;

    // Referências por bairro/cidade: 1º Google Maps (cache), 2º mediana dos
    // clientes vizinhos já localizados, descartando pontos fora do padrão.
    const norm = (v: string | null | undefined) => (v ?? "").trim().toUpperCase();
    const pontos = new Map<string, { lat: number; lng: number }[]>();
    const acumular = (chave: string, lat: number, lng: number) => {
      const arr = pontos.get(chave) ?? [];
      arr.push({ lat, lng });
      pontos.set(chave, arr);
    };
    const chaveCidade = (uf: string, cidade: string) => `C|${uf}|${cidade}`;
    const chaveBairro = (uf: string, cidade: string, bairro: string) => `B|${uf}|${cidade}|${bairro}`;
    for (const c of clientesErp) {
      const geo = geoPorCliente.get(String(c.cod_cliente).trim());
      if (!geo) continue;
      const uf = norm(c.uf);
      const cidade = norm(c.cidade);
      const bairro = norm(c.bairro);
      if (uf && cidade) {
        acumular(chaveCidade(uf, cidade), geo.lat, geo.lng);
        if (bairro) acumular(chaveBairro(uf, cidade, bairro), geo.lat, geo.lng);
      }
    }
    const mediana = (v: number[]) => {
      const s = [...v].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    // Raio máximo aceitável em torno da mediana (km).
    const RAIO_BAIRRO = 15;
    const RAIO_CIDADE = 60;
    const centroide = (chave: string, raio: number) => {
      const arr = pontos.get(chave);
      if (!arr?.length) return undefined;
      const centro = { lat: mediana(arr.map((p) => p.lat)), lng: mediana(arr.map((p) => p.lng)) };
      const proximos = arr.filter((p) => haversineKm(centro.lat, centro.lng, p.lat, p.lng) <= raio);
      // Exige que a maioria concorde; senão a referência não é confiável.
      if (proximos.length * 2 < arr.length || !proximos.length) return undefined;
      return {
        lat: mediana(proximos.map((p) => p.lat)),
        lng: mediana(proximos.map((p) => p.lng)),
      };
    };
    const geoLocalidade = new Map<string, { lat: number; lng: number }>();
    for (const l of localidadesQ.data ?? []) {
      if (l.lat != null && l.lng != null) geoLocalidade.set(l.chave, { lat: l.lat, lng: l.lng });
    }
    const googleLocal = (uf: string, cidade: string, bairro: string) =>
      geoLocalidade.get(`${norm(uf)}|${norm(cidade)}|${norm(bairro)}`);
    // Distância aproximada acima disso (km) é descartada como improvável.
    const LIMITE_APROX_KM = 3000;

    const porCliente = new Map<string, typeof linhas>();
    for (const l of linhas) {
      const chave = l.codCliente || l.cliente;
      const arr = porCliente.get(chave) ?? [];
      arr.push(l);
      porCliente.set(chave, arr);
    }

    const gruposBase = Array.from(porCliente.entries())
      .map(([chave, pedidos]) => {
        const ref = pedidos[0];
        const coordenadaPedido = pedidos
          .filter(
            (pedido) => pedido.deliveryLatitude != null && pedido.deliveryLongitude != null,
          )
          .map((pedido) => ({ lat: Number(pedido.deliveryLatitude), lng: Number(pedido.deliveryLongitude) }))
          .find((coordenada) => Number.isFinite(coordenada.lat) && Number.isFinite(coordenada.lng));
        const geoCadastro = ref.codCliente ? geoPorCliente.get(ref.codCliente) : undefined;
        // Ordem: pedido → cadastro → bairro (Google/vizinhos) → cidade (Google/vizinhos).
        let geo = coordenadaPedido ?? geoCadastro;
        let precisao: "exata" | "bairro" | "cidade" | null = geo ? "exata" : null;
        const uf = norm(ref.uf);
        const cid = norm(ref.cidade);
        const bai = norm(ref.bairro);
        if (!geo && bai) {
          geo = googleLocal(uf, cid, bai) ?? centroide(chaveBairro(uf, cid, bai), RAIO_BAIRRO);
          if (geo) precisao = "bairro";
        }
        if (!geo && cid) {
          geo = googleLocal(uf, cid, "") ?? centroide(chaveCidade(uf, cid), RAIO_CIDADE);
          if (geo) precisao = "cidade";
        }
        if (
          geo && precisao !== "exata" && deposito &&
          haversineKm(deposito.lat, deposito.lng, geo.lat, geo.lng) > LIMITE_APROX_KM
        ) {
          geo = undefined;
          precisao = null;
        }
        const distanciaKm =
          deposito && geo ? haversineKm(deposito.lat, deposito.lng, geo.lat, geo.lng) : null;
        return {
          chave,
          pedidos,
          codCliente: ref.codCliente,
          cliente: ref.cliente,
          cidade: ref.cidade,
          bairro: ref.bairro,
          uf: ref.uf,
          distanciaKm,
          precisao: distanciaKm != null ? precisao : null,
          valor: pedidos.reduce((s, p) => s + p.valor, 0),
          peso: pedidos.reduce((s, p) => s + p.peso, 0),
        };
      });

    const menorDistancia = (chave: (g: (typeof gruposBase)[number]) => string) => {
      const mapa = new Map<string, number>();
      for (const g of gruposBase) {
        if (g.distanciaKm == null) continue;
        const k = chave(g);
        mapa.set(k, Math.min(mapa.get(k) ?? Number.POSITIVE_INFINITY, g.distanciaKm));
      }
      return mapa;
    };
    const ufKey = (g: (typeof gruposBase)[number]) => g.uf || "~";
    const cidadeKey = (g: (typeof gruposBase)[number]) => `${ufKey(g)}|${g.cidade || "~"}`;
    const bairroKey = (g: (typeof gruposBase)[number]) => `${cidadeKey(g)}|${g.bairro || "~"}`;
    const distUf = menorDistancia(ufKey);
    const distCidade = menorDistancia(cidadeKey);
    const distBairro = menorDistancia(bairroKey);
    const compararDistancia = (a: number | undefined, b: number | undefined) =>
      (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);

    return gruposBase.sort((a, b) =>
      compararDistancia(distUf.get(ufKey(a)), distUf.get(ufKey(b))) ||
      ufKey(a).localeCompare(ufKey(b)) ||
      compararDistancia(distCidade.get(cidadeKey(a)), distCidade.get(cidadeKey(b))) ||
      cidadeKey(a).localeCompare(cidadeKey(b)) ||
      compararDistancia(distBairro.get(bairroKey(a)), distBairro.get(bairroKey(b))) ||
      bairroKey(a).localeCompare(bairroKey(b)) ||
      compararDistancia(a.distanciaKm ?? undefined, b.distanciaKm ?? undefined) ||
      a.cliente.localeCompare(b.cliente),
    );
  }, [linhas, geoQ.data, depositoQ.data, clientesErp, localidadesQ.data]);

  const opcoes = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    function agrupar(campo: "uf" | "cidade" | "bairro" | "agenda" | "filial"): OpcaoFiltro[] {
      const map = new Map<string, OpcaoFiltro>();
      for (const l of linhas) {
        if (termo && !`${l.numero} ${l.cliente} ${l.cidade}`.toLowerCase().includes(termo)) continue;
        if (campo !== "uf" && uf.length && !uf.includes(l.uf || "(vazio)")) continue;
        if (campo !== "cidade" && cidade.length && !cidade.includes(l.cidade || "(vazio)")) continue;
        if (campo !== "bairro" && bairro.length && !bairro.includes(l.bairro || "(vazio)")) continue;
        if (campo !== "agenda" && agenda.length && !agenda.includes(l.agenda || "(vazio)")) continue;
        if (campo !== "filial" && filial.length && !filial.includes(l.filial || "(vazio)")) continue;
        const v = String(l[campo] || "(vazio)");
        const atual = map.get(v) ?? { valor: v, qtd: 0, peso: 0, valorTotal: 0 };
        atual.qtd += 1;
        atual.peso += l.peso;
        atual.valorTotal += l.valor;
        map.set(v, atual);
      }
      return Array.from(map.values()).sort((a, b) => a.valor.localeCompare(b.valor));
    }

    return {
      uf: agrupar("uf"),
      cidade: agrupar("cidade"),
      bairro: agrupar("bairro"),
      agenda: agrupar("agenda"),
      filial: agrupar("filial"),
    };
  }, [linhas, uf, cidade, bairro, agenda, filial, busca]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (uf.length && !uf.includes(l.uf || "(vazio)")) return false;
      if (cidade.length && !cidade.includes(l.cidade || "(vazio)")) return false;
      if (bairro.length && !bairro.includes(l.bairro || "(vazio)")) return false;
      if (agenda.length && !agenda.includes(l.agenda || "(vazio)")) return false;
      if (filial.length && !filial.includes(l.filial || "(vazio)")) return false;
      if (termo && !`${l.numero} ${l.cliente} ${l.cidade}`.toLowerCase().includes(termo))
        return false;
      return true;
    });
  }, [linhas, uf, cidade, bairro, agenda, filial, busca]);

  // Ao mexer nos filtros, marca automaticamente todos os pedidos filtrados.
  // A primeira carga da tela fica sem seleção; limpar todos os filtros não
  // recria a seleção sozinho.
  const filtrosKey = useMemo(
    () => [uf, cidade, bairro, agenda, filial].map((f) => f.join("|")).join("~"),
    [uf, cidade, bairro, agenda, filial],
  );
  const primeiraCarga = useRef(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (primeiraCarga.current) {
      primeiraCarga.current = false;
      return;
    }
    if (!filtrosKey.replace(/[|~]/g, "")) return;
    setSelecionados(filtradas.map((l) => l.id));
    // Depende só dos filtros: recarregar a lista (atribuição, sync do ERP)
    // não deve recriar a seleção que o usuário acabou de usar.
  }, [filtrosKey]);

  // Grupos visíveis: mantém a ordenação por distância e só pedidos filtrados.
  const gruposFiltrados = useMemo(() => {
    const ids = new Set(filtradas.map((l) => l.id));
    return grupos
      .map((g) => ({ ...g, pedidos: g.pedidos.filter((p) => ids.has(p.id)) }))
      .filter((g) => g.pedidos.length > 0);
  }, [grupos, filtradas]);

  const idsFiltrados = filtradas.map((l) => l.id);
  const todosMarcados =
    idsFiltrados.length > 0 && idsFiltrados.every((id) => selecionados.includes(id));

  const resumoSelecao = useMemo(() => {
    const sel = new Set(selecionados);
    const escolhidas = linhas.filter((l) => sel.has(l.id));
    return {
      qtd: escolhidas.length,
      entregas: new Set(escolhidas.map((l) => l.codCliente || l.cliente)).size,
      peso: escolhidas.reduce((s, l) => s + l.peso, 0),
      valor: escolhidas.reduce((s, l) => s + l.valor, 0),
    };
  }, [linhas, selecionados]);

  // Formulário de atribuição
  const [aba, setAba] = useState<"nova" | "existente">("nova");
  const [dataRota, setDataRota] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [nomeRota, setNomeRota] = useState("");
  const [responsavel, setResponsavel] = useState<string>("");
  const [rotaExistente, setRotaExistente] = useState<string>("");

  const atribuir = useServerFn(atribuirPedidosARota);
  const mutation = useMutation({
    mutationFn: async () => {
      const resp = (responsaveisQ.data ?? []).find((r) => r.codErp === responsavel);
      return atribuir({
        data:
          aba === "nova"
            ? {
                orderIds: selecionados,
                nova: {
                  data: dataRota,
                  nome: nomeRota,
                  codResponsavel: responsavel || null,
                  nomeResponsavel: resp?.razaoSocial ?? null,
                },
              }
            : (() => {
                const r = (rotasQ.data ?? []).find((x) => x.id === rotaExistente);
                return {
                  orderIds: selecionados,
                  routeId: rotaExistente,
                  routeErpId: r?.erp_route_id ?? null,
                  routeCode: r?.code ?? null,
                };
              })(),
      });
    },
    onSuccess: (r) => {
      toast.success(
        `${r.adicionados} pedido(s) atribuído(s) à rota ${r.nomeRota}` +
          (r.vinculadosErp ? ` — ${r.vinculadosErp} enviado(s) ao ERP` : ""),
      );
      for (const aviso of r.avisos ?? []) toast.warning(aviso);
      setSelecionados([]);
      setPainelAberto(false);
      setNomeRota("");
      setRotaExistente("");
      qc.invalidateQueries({ queryKey: ["pedidos-sem-rota"] });
      qc.invalidateQueries({ queryKey: ["rotas-planejadas-sem-rota"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Não foi possível atribuir os pedidos";
      toast.error(msg);
      if (msg.includes("Rota não encontrada")) {
        // A rota escolhida deixou de existir (ex.: removida/reorganizada pela sincronização do ERP).
        setRotaExistente("");
        qc.invalidateQueries({ queryKey: ["rotas-planejadas-sem-rota"] });
      }
    },
  });

  const podeSalvar =
    selecionados.length > 0 &&
    (aba === "nova" ? Boolean(dataRota && nomeRota.trim()) : Boolean(rotaExistente));

  return (
    <AppShell>
      <div className="w-full px-3 pb-28 pt-3 sm:px-4 lg:px-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Pedidos sem rota</h1>
            <p className="text-xs text-muted-foreground">
              {filtradas.length} de {linhas.length} pedidos sem previsão de expedição
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => pedidosQ.refetch()}
            aria-label="Atualizar"
          >
            <RefreshCw className={`h-4 w-4 ${pedidosQ.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pedido ou cliente"
            className="h-9 pl-8 text-sm"
          />
        </div>

        <div className="mb-2 flex flex-wrap gap-1.5">
          <MultiFiltro label="Estado" opcoes={opcoes.uf} selecionados={uf} onChange={setUf} />
          <MultiFiltro
            label="Cidade"
            opcoes={opcoes.cidade}
            selecionados={cidade}
            onChange={setCidade}
          />
          <MultiFiltro
            label="Bairro"
            opcoes={opcoes.bairro}
            selecionados={bairro}
            onChange={setBairro}
          />
          <MultiFiltro
            label="Agenda"
            opcoes={opcoes.agenda}
            selecionados={agenda}
            onChange={setAgenda}
          />
          <MultiFiltro
            label="Filial"
            opcoes={opcoes.filial}
            selecionados={filial}
            onChange={setFilial}
          />
        </div>

        <div className="mb-2 flex items-center gap-2 border-y py-1.5">
          <Checkbox
            id="todos"
            checked={todosMarcados}
            onCheckedChange={(v) =>
              setSelecionados((prev) =>
                v ? Array.from(new Set([...prev, ...idsFiltrados])) : prev.filter((id) => !idsFiltrados.includes(id)),
              )
            }
          />
          <Label htmlFor="todos" className="text-xs">
            Selecionar todos os filtrados
          </Label>
        </div>

        {pedidosQ.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : filtradas.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum pedido sem rota com esses filtros.
          </p>
        ) : (
          <div className="space-y-2">
            {detalhesQ.isLoading && (
              <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando detalhes dos pedidos no ERP…
              </div>
            )}
            {detalhesQ.isError && (
              <div className="rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                Os detalhes do ERP estão temporariamente indisponíveis. A seleção e a atribuição continuam disponíveis.
              </div>
            )}
            {gruposFiltrados.map((g) => {
              const idsGrupo = g.pedidos.map((p) => p.id);
              const marcadosGrupo = idsGrupo.filter((id) => selecionados.includes(id));
              const todosDoGrupo = marcadosGrupo.length === idsGrupo.length;
              const algumDoGrupo = marcadosGrupo.length > 0;
              return (
                <section key={g.chave} className="overflow-hidden rounded border bg-card">
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 border-b bg-muted/45 px-2.5 py-2">
                    <Checkbox
                      checked={todosDoGrupo ? true : algumDoGrupo ? "indeterminate" : false}
                      className="mt-0.5"
                      aria-label={`Selecionar pedidos de ${g.cliente}`}
                      onCheckedChange={() =>
                        setSelecionados((prev) =>
                          todosDoGrupo
                            ? prev.filter((id) => !idsGrupo.includes(id))
                            : Array.from(new Set([...prev, ...idsGrupo])),
                        )
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight">
                        {g.cliente}{g.codCliente ? ` (${g.codCliente})` : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {[g.uf, g.cidade, g.bairro].filter(Boolean).join(" · ") || "Localidade não informada"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right text-[10px] leading-4 text-muted-foreground">
                      <p>
                        {g.distanciaKm != null
                          ? `${g.distanciaKm.toFixed(0)} km`
                          : "Endereço não localizado"}{" "}
                        {g.precisao === "bairro" && (
                          <span
                            className="rounded bg-amber-100 px-1 py-px text-[9px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            title="Endereço exato não localizado; distância aproximada até o bairro"
                          >
                            ≈ bairro
                          </span>
                        )}
                        {g.precisao === "cidade" && (
                          <span
                            className="rounded bg-amber-100 px-1 py-px text-[9px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            title="Endereço exato não localizado; distância aproximada até a cidade"
                          >
                            ≈ cidade
                          </span>
                        )}{" "}
                        · {g.pedidos.length} pedido(s)
                      </p>
                      <p>{brl(g.valor)} · {g.peso.toFixed(0)} kg</p>
                    </div>
                  </div>

                  <div className="hidden grid-cols-[26px_82px_minmax(92px,.8fr)_44px_70px_minmax(110px,1fr)_48px_68px_68px_34px_42px_42px] gap-x-1 border-b bg-muted/20 px-2 py-1 text-[9px] font-semibold text-muted-foreground lg:grid">
                    <span />
                    <span>Pedido</span><span>Status</span><span>Filial</span><span>NF</span><span>Vendedor</span>
                    <span>Agenda</span><span>Dt. pedido</span><span>Dt. agenda</span><span>OBS</span><span>OBS LOG.</span><span>INF_CMP</span>
                  </div>

                  <ul className="divide-y divide-dashed">
                    {[...g.pedidos]
                      .sort((a, b) => (a.dtAgenda ?? "~").localeCompare(b.dtAgenda ?? "~") || a.numero.localeCompare(b.numero))
                      .map((p) => {
                        const marcado = selecionados.includes(p.id);
                        return (
                          <li key={p.id} className="px-2 py-2 lg:grid lg:grid-cols-[26px_82px_minmax(92px,.8fr)_44px_70px_minmax(110px,1fr)_48px_68px_68px_34px_42px_42px] lg:items-center lg:gap-x-1 lg:py-1.5 lg:text-[10px]">
                            <Checkbox
                              checked={marcado}
                              aria-label={`Selecionar pedido ${p.numero}`}
                              onCheckedChange={() =>
                                setSelecionados((prev) =>
                                  marcado ? prev.filter((id) => id !== p.id) : [...prev, p.id],
                                )
                              }
                            />
                            <div className="ml-8 -mt-5 lg:m-0">
                              <PedidoCodigo codigo={p.numero} />
                              <p className="text-[9px] text-muted-foreground lg:hidden">{brl(p.valor)} · {p.peso.toFixed(0)} kg</p>
                            </div>
                            <p className="mt-2 text-xs font-medium lg:m-0 lg:text-[10px]">{p.status ?? "—"}</p>
                            <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-4 lg:contents">
                              <div className="lg:contents"><dt className="text-muted-foreground lg:hidden">Filial</dt><dd>{p.filial || "—"}</dd></div>
                              <div className="lg:contents"><dt className="text-muted-foreground lg:hidden">NF</dt><dd className="break-words">{p.nf ?? "—"}</dd></div>
                              <div className="min-w-0 lg:contents"><dt className="text-muted-foreground lg:hidden">Vendedor</dt><dd className="min-w-0 break-words">{p.vendedor ?? "—"}{p.codVendedor ? ` (${p.codVendedor})` : ""}</dd></div>
                              <div className="lg:contents"><dt className="text-muted-foreground lg:hidden">Agenda</dt><dd>{p.agenda || "—"}</dd></div>
                              <div className="lg:contents"><dt className="text-muted-foreground lg:hidden">Dt. pedido</dt><dd className="whitespace-nowrap">{dataBr(p.dtPedido)}</dd></div>
                              <div className="lg:contents"><dt className="text-muted-foreground lg:hidden">Dt. agenda</dt><dd className="whitespace-nowrap">{dataBr(p.dtAgenda)}</dd></div>
                            </dl>
                            <div className="mt-2 flex items-center gap-2 lg:contents">
                              <Observacao label="OBS" texto={p.obs} />
                              <Observacao label="OBS LOGIST" texto={p.obsLogist} />
                              <Observacao label="INF_CMP" texto={p.infCmp} />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {selecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
            <div className="text-xs leading-tight">
              <p className="font-medium">
                {resumoSelecao.qtd} pedido(s) · {resumoSelecao.entregas} entrega(s)
              </p>
              <p className="text-muted-foreground">
                {brl(resumoSelecao.valor)} · {resumoSelecao.peso.toFixed(0)} kg
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
                Limpar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void rotasQ.refetch();
                  setPainelAberto(true);
                }}
              >
                Atribuir rota
              </Button>
            </div>
          </div>
        </div>
      )}

      <Sheet open={painelAberto} onOpenChange={setPainelAberto}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="text-base">
              Atribuir {selecionados.length} pedido(s)
            </SheetTitle>
          </SheetHeader>

          <Tabs value={aba} onValueChange={(v) => setAba(v as "nova" | "existente")} className="mt-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="nova">Nova rota</TabsTrigger>
              <TabsTrigger value="existente">Rota existente</TabsTrigger>
            </TabsList>

            <TabsContent value="nova" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label htmlFor="data" className="text-xs">
                  Data de previsão de expedição
                </Label>
                <Input
                  id="data"
                  type="date"
                  value={dataRota}
                  onChange={(e) => setDataRota(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nome" className="text-xs">
                  Nome da rota
                </Label>
                <Input
                  id="nome"
                  value={nomeRota}
                  onChange={(e) => setNomeRota(e.target.value.toUpperCase())}
                  placeholder="Ex.: ZONA SUL"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Responsável (opcional)</Label>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sem responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {(responsaveisQ.data ?? []).map((r) => (
                      <SelectItem key={r.codErp} value={r.codErp}>
                        {r.razaoSocial}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="existente" className="space-y-3 pt-3">
              <div className="space-y-1">
                <Label className="text-xs">Rota planejada</Label>
                <Select value={rotaExistente} onValueChange={setRotaExistente}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Escolha a rota" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rotasQ.data ?? []).map((r) => {
                      const nome = r.notes?.startsWith("Rota ") ? r.notes.slice(5) : r.code;
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          {nome} · {r.route_date.split("-").reverse().join("/")}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            className="mt-4 w-full"
            disabled={!podeSalvar || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar atribuição
          </Button>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
