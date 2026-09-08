import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bookmark,
  Check,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Share2,
  Trash2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  deleteFilterView,
  getFilterViewShares,
  listFilterViews,
  saveFilterView,
  setFilterViewShares,
  type FilterView,
  type FilterViewDefinition,
} from "@/lib/filter-views.functions";

type Props = {
  tableKey: string;
  /** Filtros + ordenação atuais, usados ao salvar uma nova visão. */
  definicaoAtual: FilterViewDefinition;
  onAplicar: (def: FilterViewDefinition) => void;
};

export function FilterViewsBar({ tableKey, definicaoAtual, onAplicar }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listFilterViews);
  const saveFn = useServerFn(saveFilterView);
  const delFn = useServerFn(deleteFilterView);
  const sharesFn = useServerFn(getFilterViewShares);
  const setSharesFn = useServerFn(setFilterViewShares);

  const [salvarAberto, setSalvarAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [compartilhando, setCompartilhando] = useState<{ id: string; nome: string } | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [aplicada, setAplicada] = useState<string | null>(null);

  const viewsQ = useQuery({
    queryKey: ["filter-views", tableKey],
    queryFn: () => listFn({ data: { tableKey } }),
    staleTime: 60_000,
  });

  const todas: FilterView[] = (viewsQ.data ?? []) as FilterView[];
  const minhas = todas.filter((v) => !v.shared);
  const recebidas = todas.filter((v) => v.shared);

  const salvar = useMutation({
    mutationFn: () =>
      saveFn({ data: { tableKey, name: nome, definition: definicaoAtual } }),
    onSuccess: () => {
      toast.success("Visão de filtro salva");
      setSalvarAberto(false);
      setNome("");
      void qc.invalidateQueries({ queryKey: ["filter-views", tableKey] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar"),
  });

  /** Regrava uma visão existente com os filtros/colunas atuais da tela. */
  const atualizar = useMutation({
    mutationFn: (v: { id: string; name: string }) =>
      saveFn({ data: { id: v.id, tableKey, name: v.name, definition: definicaoAtual } }),
    onSuccess: (_d, v) => {
      toast.success(`“${v.name}” atualizada com os filtros e colunas atuais`);
      void qc.invalidateQueries({ queryKey: ["filter-views", tableKey] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível atualizar"),
  });

  const renomear = useMutation({
    mutationFn: (v: { id: string; name: string; definition: FilterViewDefinition }) =>
      saveFn({ data: { id: v.id, tableKey, name: v.name, definition: v.definition } }),
    onSuccess: () => {
      toast.success("Visão renomeada");
      setRenomeando(null);
      void qc.invalidateQueries({ queryKey: ["filter-views", tableKey] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível renomear"),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Visão excluída");
      void qc.invalidateQueries({ queryKey: ["filter-views", tableKey] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível excluir"),
  });

  function aplicarVisao(v: FilterView) {
    onAplicar(v.definition);
    setAplicada(v.name);
    const semColunas =
      !Array.isArray(v.definition?.columnOrder) && !Array.isArray(v.definition?.visibleColumns);
    if (semColunas) {
      toast.info(
        `“${v.name}” guarda apenas os filtros. Ajuste as colunas e use “Atualizar” para gravá-las nessa visão.`,
      );
    }
  }

  const sharesQ = useQuery({
    queryKey: ["filter-view-shares", compartilhando?.id],
    queryFn: () => sharesFn({ data: { id: compartilhando!.id } }),
    enabled: !!compartilhando,
  });

    onSuccess: () => {
      toast.success("Compartilhamento atualizado");
      setCompartilhando(null);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível compartilhar"),
  });

  function abrirCompartilhar(id: string, nomeVisao: string) {
    setSelecionados([]);
    setCompartilhando({ id, nome: nomeVisao });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
              <Bookmark className="h-3.5 w-3.5" />
              {aplicada ?? "Visões de filtro"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-xs">Minhas visões</DropdownMenuLabel>
            {minhas.length === 0 && (
              <p className="px-2 pb-1 text-xs text-muted-foreground">Nenhuma salva ainda.</p>
            )}
            {minhas.map((v) => (
              <DropdownMenuItem
                key={v.id}
                className="flex items-center justify-between gap-2 text-xs"
                onSelect={(e) => {
                  e.preventDefault();
                  onAplicar(v.definition);
                  setAplicada(v.name);
                }}
              >
                <span className="truncate">{v.name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    title="Compartilhar"
                    className="rounded p-1 hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirCompartilhar(v.id, v.name);
                    }}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Excluir"
                    className="rounded p-1 text-destructive hover:bg-muted"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluir.mutate(v.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </span>
              </DropdownMenuItem>
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs">Compartilhadas comigo</DropdownMenuLabel>
            {recebidas.length === 0 && (
              <p className="px-2 pb-1 text-xs text-muted-foreground">Nenhuma recebida.</p>
            )}
            {recebidas.map((v) => (
              <DropdownMenuItem
                key={v.id}
                className="text-xs"
                onSelect={() => {
                  onAplicar(v.definition);
                  setAplicada(v.name);
                }}
              >
                <Users className="mr-2 h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {v.name}
                  {v.ownerName ? ` · ${v.ownerName}` : ""}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => setSalvarAberto(true)}
        >
          <Save className="h-3.5 w-3.5" /> Salvar visão
        </Button>
      </div>

      <Dialog open={salvarAberto} onOpenChange={setSalvarAberto}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Salvar visão de filtro</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Atrasos acima de 10 dias"
            />
            <p className="text-xs text-muted-foreground">
              Usar o mesmo nome de uma visão existente substitui os filtros dela.
            </p>
          </div>
          <DialogFooter>
            <Button
              className="w-full"
              disabled={!nome.trim() || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!compartilhando}
        onOpenChange={(o) => {
          if (!o) setCompartilhando(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              Compartilhar “{compartilhando?.nome}”
            </DialogTitle>
          </DialogHeader>
          {sharesQ.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando usuários…
            </div>
          )}
          {sharesQ.data && (
            <SharesPicker
              usuarios={sharesQ.data.usuarios}
              iniciais={sharesQ.data.selecionados}
              onChange={setSelecionados}
            />
          )}
          <DialogFooter>
            <Button
              className="w-full"
              disabled={gravarShares.isPending || !sharesQ.data}
              onClick={() => gravarShares.mutate()}
            >
              {gravarShares.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Salvar compartilhamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SharesPicker({
  usuarios,
  iniciais,
  onChange,
}: {
  usuarios: { id: string; nome: string }[];
  iniciais: string[];
  onChange: (ids: string[]) => void;
}) {
  const [sel, setSel] = useState<string[]>(iniciais);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setSel(iniciais);
    onChange(iniciais);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iniciais.join(",")]);

  function alternar(id: string) {
    const next = sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
    setSel(next);
    onChange(next);
  }

  const lista = usuarios.filter((u) =>
    u.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  return (
    <div className="space-y-2">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar pessoa"
        className="h-8"
      />
      <ScrollArea className="h-56 rounded-md border">
        <div className="space-y-1 p-2">
          {lista.length === 0 && (
            <p className="p-2 text-xs text-muted-foreground">Nenhum usuário encontrado.</p>
          )}
          {lista.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
            >
              <Checkbox checked={sel.includes(u.id)} onCheckedChange={() => alternar(u.id)} />
              <span className="truncate">{u.nome}</span>
            </label>
          ))}
        </div>
      </ScrollArea>
      <p className="text-xs text-muted-foreground">{sel.length} pessoa(s) com acesso.</p>
    </div>
  );
}
