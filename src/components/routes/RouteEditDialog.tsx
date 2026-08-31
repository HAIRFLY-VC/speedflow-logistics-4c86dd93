"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
  type ResponsavelErp,
} from "@/lib/rota-erp.functions";
import { supabase } from "@/integrations/central/client";

export type EditableRoute = {
  id: string;
  code: string;
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
  onSuccess?: () => void;
};

const TIPO_LABEL: Record<ResponsavelErp["tipoFrete"], string> = {
  P: "Própria",
  F: "Fretista",
  T: "Transportadora",
};

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
  onSuccess,
}: RouteEditDialogProps) {
  const qc = useQueryClient();
  const getResponsaveis = useServerFn(listarResponsaveisErp);
  const doAtualizar = useServerFn(atualizarCapaRotaErp);

  const [dtPrevExp, setDtPrevExp] = useState("");
  const [nomeRota, setNomeRota] = useState("");
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [codFrtTrp, setCodFrtTrp] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (!route) return;
    setDtPrevExp(toDateInput(route.route_date));
    setNomeRota(route.code ?? "");
    setNomeMotorista(route.driver_name ?? "");
    setCodFrtTrp(initialCodErp ?? null);
  }, [route, initialCodErp]);

  const responsaveisQ = useQuery({
    queryKey: ["responsaveis-erp"],
    queryFn: () => getResponsaveis(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const responsaveis = responsaveisQ.data ?? [];
  const selected = useMemo(
    () => responsaveis.find((r) => r.codErp === codFrtTrp) ?? null,
    [responsaveis, codFrtTrp],
  );

  const filteredBySearch = useMemo(() => {
    return responsaveis;
  }, [responsaveis]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!route) throw new Error("Rota não encontrada");
      if (!route.erp_route_id) throw new Error("Rota sem vínculo ERP");

      const nome = nomeRota.trim().toUpperCase();
      if (!nome) throw new Error("Informe o nome da rota");

      await doAtualizar({
        data: {
          id: Number(route.erp_route_id),
          dtPrevExpYyyyMMdd: toYyyyMMdd(dtPrevExp),
          nomeRota: nome,
          nomeMotorista: nomeMotorista.trim().toUpperCase() || null,
          codFrtTrp: codFrtTrp?.trim() || null,
          status: route.erp_status ?? "P",
        },
      });

      const { error } = await supabase
        .from("routes")
        .update({
          route_date: dtPrevExp || null,
          code: nome,
          notes: nomeMotorista.trim() || null,
        })
        .eq("id", route.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rota atualizada no ERP");
      qc.invalidateQueries({ queryKey: ["routes"] });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar rota</DialogTitle>
          <DialogDescription>
            Altere os dados da capa da rota. As mudanças serão replicadas para o ERP.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
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
            <Label htmlFor="nomeMotorista">Motorista / Responsável</Label>
            <Input
              id="nomeMotorista"
              value={nomeMotorista}
              onChange={(e) => setNomeMotorista(e.target.value)}
              placeholder="Nome do motorista"
            />
          </div>

          <div className="grid gap-2">
            <Label>Transportadora / Fretista / Frota própria</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={searchOpen}
                  className="justify-between font-normal"
                  disabled={responsaveisQ.isLoading}
                >
                  {selected ? (
                    <span className="truncate">
                      {selected.razaoSocial} ({selected.codErp}) ·{" "}
                      {TIPO_LABEL[selected.tipoFrete]}
                    </span>
                  ) : (
                    "Selecione o responsável"
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
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
                          setCodFrtTrp(r.codErp);
                          setNomeMotorista(r.razaoSocial);
                          setSearchOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            codFrtTrp === r.codErp ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{r.razaoSocial}</span>
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending}>
            {salvar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar no ERP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
