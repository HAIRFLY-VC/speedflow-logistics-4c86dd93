"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useServerFn } from "@tanstack/react-start";
import {
  listarResponsaveisErp,
  atualizarCapaRotaErp,
  buscarResponsavelRotaErp,
  type ResponsavelErp,
} from "@/lib/rota-erp.functions";
import { supabase } from "@/integrations/central/client";

export type EditableRoute = {
  id: string;
  code: string;
  /** Nome exibido na listagem (pode diferir do código interno). */
  nomeRota?: string | null;
  route_date: string;
  notes: string | null;
  driver_name: string | null;
  erp_route_id: string | null;
  erp_status: string | null;
};

type RouteEditDialogProps = {
  route: EditableRoute | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCodErp: string | null;
  initialResponsavel?: ResponsavelErp | null;
  onSuccess?: () => void;
};

const TIPO_LABEL: Record<ResponsavelErp["tipoFrete"], string> = {
  P: "Própria",
  F: "Fretista",
  T: "Transportadora",
};

function normalizaCod(v: string | null | undefined): string {
  const s = String(v ?? "").trim().replace(/^0+/, "");
  return s;
}

function normalizaNome(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  if (value.startsWith("3000-01-01") || value.startsWith("4000-01-01")) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function toYyyyMMdd(value: string): string | null {
  if (!value) return null;
  const [y, m, d] = value.split("-");
  if (!y || !m || !d) return null;
  return `${y}${m}${d}`;
}

export function RouteEditDialog({
  route,
  open,
  onOpenChange,
  initialCodErp,
  initialResponsavel = null,
  onSuccess,
}: RouteEditDialogProps) {
  const qc = useQueryClient();
  const getResponsaveis = useServerFn(listarResponsaveisErp);
  const doAtualizar = useServerFn(atualizarCapaRotaErp);
  const getResponsavelRota = useServerFn(buscarResponsavelRotaErp);

  const [dtPrevExp, setDtPrevExp] = useState("");
  const [nomeRota, setNomeRota] = useState("");
  const [codFrtTrp, setCodFrtTrp] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  /** Usuário limpou o campo: impede que as pré-seleções o preencham de novo. */
  const [limpoPeloUsuario, setLimpoPeloUsuario] = useState(false);

  useEffect(() => {
    if (!route) return;
    setDtPrevExp(toDateInput(route.route_date));
    setNomeRota((route.nomeRota ?? route.code ?? "").trim());
    setCodFrtTrp(initialCodErp ?? null);
    setLimpoPeloUsuario(false);
  }, [route, initialCodErp]);

  const responsaveisQ = useQuery({
    queryKey: ["responsaveis-erp"],
    queryFn: () => getResponsaveis(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Código do responsável direto no ERP (fonte da verdade da capa da rota).
  const codRotaErpQ = useQuery({
    queryKey: ["rota-responsavel-erp", route?.erp_route_id],
    queryFn: () => getResponsavelRota({ data: { idRota: Number(route?.erp_route_id) } }),
    enabled: open && !!route?.erp_route_id,
    staleTime: 60 * 1000,
  });
  const codErpRota = codRotaErpQ.data?.codErp ?? null;

  useEffect(() => {
    if (codErpRota && !limpoPeloUsuario) setCodFrtTrp(codErpRota);
  }, [codErpRota, limpoPeloUsuario]);

  const responsaveisErp = responsaveisQ.data ?? [];
  // Responsável já resolvido pela listagem (espelho local do ERP): garante a
  // pré-seleção mesmo quando o código não aparece na lista carregada aqui.
  const responsaveis = useMemo(() => {
    if (!initialResponsavel) return responsaveisErp;
    if (responsaveisErp.some((r) => normalizaCod(r.codErp) === normalizaCod(initialResponsavel.codErp))) {
      return responsaveisErp;
    }
    return [initialResponsavel, ...responsaveisErp];
  }, [responsaveisErp, initialResponsavel]);

  const selected = useMemo(() => {
    if (!codFrtTrp) return null;
    return (
      responsaveis.find((r) => r.codErp === codFrtTrp) ??
      responsaveis.find((r) => normalizaCod(r.codErp) === normalizaCod(codFrtTrp)) ??
      null
    );
  }, [responsaveis, codFrtTrp]);

  // Pré-seleciona o responsável quando o código do ERP não bate exatamente
  // (zeros à esquerda/espaços) ou quando só temos a razão social na rota.
  useEffect(() => {
    if (!open || limpoPeloUsuario || responsaveis.length === 0) return;
    if (codFrtTrp && responsaveis.some((r) => r.codErp === codFrtTrp)) return;

    const alvoCod = normalizaCod(codFrtTrp ?? codErpRota ?? initialCodErp);
    if (alvoCod) {
      const porCod = responsaveis.find((r) => normalizaCod(r.codErp) === alvoCod);
      if (porCod) {
        setCodFrtTrp(porCod.codErp);
        return;
      }
    }
    const alvoNome = normalizaNome(route?.driver_name ?? "");
    if (alvoNome.length >= 4) {
      const porNome = responsaveis.find((r) => {
        const n = normalizaNome(r.razaoSocial);
        return n === alvoNome || n.startsWith(alvoNome) || alvoNome.startsWith(n);
      });
      if (porNome) setCodFrtTrp(porNome.codErp);
    }
  }, [open, limpoPeloUsuario, responsaveis, codFrtTrp, initialCodErp, codErpRota, route?.driver_name]);

  const filteredBySearch = useMemo(() => {
    return responsaveis;
  }, [responsaveis]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!route) throw new Error("Rota não encontrada");
      if (!route.erp_route_id) throw new Error("Rota sem vínculo ERP");

      const nome = nomeRota.trim().toUpperCase();
      if (!nome) throw new Error("Informe o nome da rota");
      const nomeMotorista = selected?.razaoSocial?.trim().toUpperCase() || null;

      await doAtualizar({
        data: {
          id: Number(route.erp_route_id),
          dtPrevExpYyyyMMdd: toYyyyMMdd(dtPrevExp),
          nomeRota: nome,
          nomeMotorista,
          codFrtTrp: codFrtTrp?.trim() || null,
          status: route.erp_status ?? "P",
        },
      });

      const { error } = await supabase
        .from("routes")
        .update({
          route_date: dtPrevExp || "3000-01-01",
          code: nome,
          notes: `Rota ${nome}`,
          driver_name: nomeMotorista,
        })
        .eq("id", route.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota atualizada no ERP");
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["rota-responsavel-erp"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar rota");
    },
  });

  if (!route) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-x-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar rota</DialogTitle>
          <DialogDescription>
            Altere os dados da capa da rota. As mudanças serão replicadas para o ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {route.erp_route_id ? (
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">ID da rota no ERP: </span>
              <span className="font-semibold tabular-nums">{route.erp_route_id}</span>
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="dtPrevExp">Data prevista de entrega</Label>
            <Input
              id="dtPrevExp"
              type="date"
              value={dtPrevExp}
              onChange={(e) => setDtPrevExp(e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="nomeRota">Nome da rota</Label>
            <Input
              id="nomeRota"
              value={nomeRota}
              onChange={(e) => setNomeRota(e.target.value.toUpperCase())}
              placeholder="Ex: M-NOVA ROTA"
            />
          </div>

          <div className="grid gap-2">
            <Label>Transportadora / Fretista / Frota própria</Label>
            <div className="flex items-start gap-2">
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="h-auto min-h-11 w-full min-w-0 items-start justify-between gap-2 whitespace-normal break-words py-2 text-left font-normal"
                    disabled={responsaveisQ.isLoading}
                  >
                    {selected ? (
                      <span className="flex min-w-0 flex-col">
                        <span className="whitespace-normal break-words">{selected.razaoSocial}</span>
                        <span className="text-xs text-muted-foreground">
                          {selected.codErp} · {TIPO_LABEL[selected.tipoFrete]}
                        </span>
                      </span>
                    ) : codFrtTrp ? (
                      <span className="flex min-w-0 flex-col">
                        <span className="text-muted-foreground">Carregando responsável…</span>
                        <span className="text-xs text-muted-foreground">Código {codFrtTrp}</span>
                      </span>
                    ) : (
                      "Selecione o responsável"
                    )}
                    <ChevronsUpDown className="mt-1 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[--radix-popover-trigger-width] max-w-[calc(100vw-2rem)] p-0"
                  align="start"
                >
                <Command>
                  <CommandInput placeholder="Buscar por razão social ou código..." />
                  <CommandList>
                    <CommandEmpty>
                      {responsaveisQ.isLoading ? "Carregando..." : "Nenhum responsável encontrado."}
                    </CommandEmpty>
                    {filteredBySearch.map((r) => (
                      <CommandItem
                        key={r.codErp}
                        value={`${r.razaoSocial} ${r.codErp} ${TIPO_LABEL[r.tipoFrete]}`}
                        onSelect={() => {
                          setLimpoPeloUsuario(false);
                          setCodFrtTrp(r.codErp);
                          setSearchOpen(false);
                        }}
                        className="items-start"
                      >
                        <Check
                          className={cn(
                            "mr-2 mt-0.5 h-4 w-4 shrink-0",
                            codFrtTrp === r.codErp ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex min-w-0 flex-col">
                          <span className="whitespace-normal break-words text-sm">{r.razaoSocial}</span>
                          <span className="text-xs text-muted-foreground">
                            {r.codErp} · {TIPO_LABEL[r.tipoFrete]}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {selected ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Limpar responsável"
                title="Limpar responsável"
                className="h-11 w-11 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setCodFrtTrp(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
              </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
          >
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar no ERP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
