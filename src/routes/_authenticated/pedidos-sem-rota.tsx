import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { MultiFiltro } from "@/components/pedidos-sem-rota/MultiFiltro";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useClientesErp } from "@/hooks/useClientesErp";
import { atribuirPedidosARota } from "@/lib/pedidos-sem-rota.functions";
import { listarResponsaveisErp } from "@/lib/rota-erp.functions";

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

const SEM_ROTA_DATE = "4000-01-01";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

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
  const { nomeCliente, cidadeCliente, bairroCliente, ufCliente } = useClientesErp();

  const pedidosQ = useQuery({
    queryKey: ["pedidos-sem-rota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, order_number, erp_id, erp_cod_cliente, total_amount, weight, cod_agenda, cod_filial, dt_prev_exp, delivery_address",
        )
        .or(`dt_prev_exp.is.null,dt_prev_exp.gte.${SEM_ROTA_DATE}`)
        .order("order_number", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

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
        .select("id, code, notes, route_date, driver_name")
        .eq("status", "planejada")
        .gte("route_date", hoje)
        .lt("route_date", "3000-01-01")
        .order("route_date", { ascending: true })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
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

  const linhas = useMemo(() => {
    return (pedidosQ.data ?? []).map((p) => ({
      id: p.id,
      numero: p.erp_id ?? p.order_number,
      codCliente: p.erp_cod_cliente ? String(p.erp_cod_cliente).trim() : "",
      cliente: nomeCliente(p.erp_cod_cliente),
      cidade: cidadeCliente(p.erp_cod_cliente) ?? "",
      bairro: bairroCliente(p.erp_cod_cliente) ?? "",
      uf: ufCliente(p.erp_cod_cliente) ?? "",
      agenda: p.cod_agenda == null ? "" : String(p.cod_agenda),
      filial: p.cod_filial ? String(p.cod_filial) : "",
      valor: Number(p.total_amount ?? 0),
      peso: Number(p.weight ?? 0),
    }));
  }, [pedidosQ.data, nomeCliente, cidadeCliente, bairroCliente, ufCliente]);

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

    const porCliente = new Map<string, typeof linhas>();
    for (const l of linhas) {
      const chave = l.codCliente || l.cliente;
      const arr = porCliente.get(chave) ?? [];
      arr.push(l);
      porCliente.set(chave, arr);
    }

    return Array.from(porCliente.entries())
      .map(([chave, pedidos]) => {
        const ref = pedidos[0];
        const geo = ref.codCliente ? geoPorCliente.get(ref.codCliente) : undefined;
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
          valor: pedidos.reduce((s, p) => s + p.valor, 0),
          peso: pedidos.reduce((s, p) => s + p.peso, 0),
        };
      })
      .sort((a, b) => {
        if (a.distanciaKm == null && b.distanciaKm == null)
          return a.cliente.localeCompare(b.cliente);
        if (a.distanciaKm == null) return 1;
        if (b.distanciaKm == null) return -1;
        return a.distanciaKm - b.distanciaKm;
      });
  }, [linhas, geoQ.data, depositoQ.data]);

  const opcoes = useMemo(() => {
    const unicos = (fn: (l: (typeof linhas)[number]) => string) =>
      Array.from(new Set(linhas.map(fn).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    return {
      uf: unicos((l) => l.uf),
      cidade: unicos((l) => l.cidade),
      bairro: unicos((l) => l.bairro),
      agenda: unicos((l) => l.agenda),
      filial: unicos((l) => l.filial),
    };
  }, [linhas]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (uf.length && !uf.includes(l.uf)) return false;
      if (cidade.length && !cidade.includes(l.cidade)) return false;
      if (bairro.length && !bairro.includes(l.bairro)) return false;
      if (agenda.length && !agenda.includes(l.agenda)) return false;
      if (filial.length && !filial.includes(l.filial)) return false;
      if (termo && !`${l.numero} ${l.cliente} ${l.cidade}`.toLowerCase().includes(termo))
        return false;
      return true;
    });
  }, [linhas, uf, cidade, bairro, agenda, filial, busca]);

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
            : { orderIds: selecionados, routeId: rotaExistente },
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
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atribuir os pedidos"),
  });

  const podeSalvar =
    selecionados.length > 0 &&
    (aba === "nova" ? Boolean(dataRota && nomeRota.trim()) : Boolean(rotaExistente));

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-3 pb-28 pt-3 sm:px-4">
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
          <ul className="divide-y">
            {filtradas.map((l) => {
              const marcado = selecionados.includes(l.id);
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setSelecionados((prev) =>
                        marcado ? prev.filter((id) => id !== l.id) : [...prev, l.id],
                      )
                    }
                    className="flex w-full items-start gap-2 py-2 text-left"
                  >
                    <Checkbox checked={marcado} className="mt-0.5 pointer-events-none" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-medium">{l.cliente}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">#{l.numero}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                        {(l.cidade || l.uf) && (
                          <span className="truncate">
                            {[l.bairro, l.cidade, l.uf].filter(Boolean).join(" · ")}
                          </span>
                        )}
                        {l.agenda && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Ag. {l.agenda}
                          </Badge>
                        )}
                        {l.filial && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">
                            Filial {l.filial}
                          </Badge>
                        )}
                        <span>{brl(l.valor)}</span>
                        {l.peso > 0 && <span>{l.peso.toFixed(0)} kg</span>}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selecionados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-3 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
            <div className="text-xs leading-tight">
              <p className="font-medium">{resumoSelecao.qtd} selecionado(s)</p>
              <p className="text-muted-foreground">
                {brl(resumoSelecao.valor)} · {resumoSelecao.peso.toFixed(0)} kg
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelecionados([])}>
                Limpar
              </Button>
              <Button size="sm" onClick={() => setPainelAberto(true)}>
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
