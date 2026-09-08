import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, PackageSearch, Pencil, Search } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { MultiFiltro, type OpcaoFiltro } from "@/components/pedidos-sem-rota/MultiFiltro";
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

const dataBr = (v: string | null) =>
  v ? v.split("-").reverse().join("/") : "—";

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
  const [ufs, setUfs] = useState<string[]>([]);
  const [cidades, setCidades] = useState<string[]>([]);
  const [transps, setTransps] = useState<string[]>([]);
  const [rcas, setRcas] = useState<string[]>([]);
  const [modais, setModais] = useState<string[]>([]);
  const [faixas, setFaixas] = useState<string[]>([]);
  const [filiais, setFiliais] = useState<string[]>([]);
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState({ acao: "", responsavel: "", prazo: "" });

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

  function aplica(lista: Item[], exceto: string) {
    return lista.filter(
      (i) =>
        (exceto === "uf" || !ufs.length || ufs.includes(i.uf ?? "(vazio)")) &&
        (exceto === "cidade" || !cidades.length || cidades.includes(i.cidade ?? "(vazio)")) &&
        (exceto === "transp" || !transps.length || transps.includes(i.transportadora)) &&
        (exceto === "rca" || !rcas.length || rcas.includes(i.rca)) &&
        (exceto === "modal" || !modais.length || modais.includes(i.modal)) &&
        (exceto === "faixa" || !faixas.length || faixas.includes(i.faixa)) &&
        (exceto === "filial" || !filiais.length || filiais.includes(i.filial)),
    );
  }

  function opcoes(campo: string, get: (i: Item) => string): OpcaoFiltro[] {
    const map = new Map<string, OpcaoFiltro>();
    for (const i of aplica(itens, campo)) {
      const valor = get(i) || "(vazio)";
      const atual = map.get(valor) ?? { valor, qtd: 0, peso: 0, valorTotal: 0 };
      atual.qtd += 1;
      atual.peso += Number(i.peso) || 0;
      atual.valorTotal += Number(i.valor) || 0;
      map.set(valor, atual);
    }
    return Array.from(map.values()).sort((a, b) => a.valor.localeCompare(b.valor, "pt-BR"));
  }

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return aplica(itens, "").filter((i) =>
      !termo
        ? true
        : [i.nro_nf, i.cod_pedido, i.cliente, i.cidade ?? "", i.transportadora]
            .join(" ")
            .toLowerCase()
            .includes(termo),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itens, busca, ufs, cidades, transps, rcas, modais, faixas, filiais]);

  const totais = useMemo(
    () => ({
      nfs: filtrados.length,
      clientes: new Set(filtrados.map((i) => i.cod_cliente ?? i.chave)).size,
      peso: filtrados.reduce((s, i) => s + (Number(i.peso) || 0), 0),
      valor: filtrados.reduce((s, i) => s + (Number(i.valor) || 0), 0),
    }),
    [filtrados],
  );

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

  return (
    <AppShell>
      <div className="space-y-3 pb-28">
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

        <div className="flex flex-wrap gap-1.5">
          <MultiFiltro label="Estado" opcoes={opcoes("uf", (i) => i.uf ?? "")} selecionados={ufs} onChange={setUfs} />
          <MultiFiltro label="Cidade" opcoes={opcoes("cidade", (i) => i.cidade ?? "")} selecionados={cidades} onChange={setCidades} />
          <MultiFiltro label="Transportadora" opcoes={opcoes("transp", (i) => i.transportadora)} selecionados={transps} onChange={setTransps} />
          <MultiFiltro label="RCA" opcoes={opcoes("rca", (i) => i.rca)} selecionados={rcas} onChange={setRcas} />
          <MultiFiltro label="Modal" opcoes={opcoes("modal", (i) => i.modal)} selecionados={modais} onChange={setModais} />
          <MultiFiltro label="Idade" opcoes={opcoes("faixa", (i) => i.faixa)} selecionados={faixas} onChange={setFaixas} />
          <MultiFiltro label="Filial" opcoes={opcoes("filial", (i) => i.filial)} selecionados={filiais} onChange={setFiliais} />
        </div>

        {entregasQ.isLoading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando entregas…
          </div>
        )}
        {entregasQ.error && (
          <p className="py-8 text-sm text-destructive">
            Não foi possível carregar as entregas.
          </p>
        )}
        {!entregasQ.isLoading && filtrados.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <PackageSearch className="h-6 w-6" />
            Nenhuma entrega em aberto para os filtros escolhidos.
          </div>
        )}

        <ul className="space-y-2">
          {filtrados.map((i) => (
            <li key={i.chave} className="rounded-lg border bg-card p-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.cliente}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {[i.uf, i.cidade].filter(Boolean).join(" · ") || "Sem endereço"}
                  </p>
                </div>
                <Badge variant={i.dias !== null && i.dias > 10 ? "destructive" : "secondary"} className="shrink-0 text-[10px]">
                  {i.dias === null ? "sem data" : `${i.dias}d`}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span>NF {i.nro_nf}</span>
                <span>Ped. {i.cod_pedido}</span>
                <span>Saída {dataBr(i.dt_saida)}</span>
                <span>{brl(Number(i.valor) || 0)}</span>
                <span>{(Number(i.peso) || 0).toFixed(0)} kg</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="truncate">{i.transportadora}</span>
                <span>{i.modal}</span>
                {i.entrega_agend === "S" && <span className="text-primary">agendada</span>}
              </div>
              <div className="mt-1.5 flex items-end justify-between gap-2">
                <div className="min-w-0 text-[11px]">
                  {i.acao?.acao ? (
                    <p className="truncate">
                      <span className="font-medium">Ação:</span> {i.acao.acao}
                      {i.acao.responsavel ? ` · ${i.acao.responsavel}` : ""}
                      {i.acao.prazo ? ` · até ${dataBr(i.acao.prazo)}` : ""}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Sem ação registrada</p>
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
            </li>
          ))}
        </ul>
      </div>

      {filtrados.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-3 py-2 text-xs backdrop-blur">
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
