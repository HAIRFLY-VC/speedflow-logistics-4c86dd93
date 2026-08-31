"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/central/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  listarResponsaveisErp,
  atualizarCapaRotaErp,
  type ResponsavelErp,
} from "@/lib/rota-erp.functions";

export type EditableRoute = {
  id: string;
  code: string;
  route_date: string | null;
  notes: string | null;
  driver_name: string | null;
  erp_route_id: string | number | null;
  erp_status: string | null;
};

function nomeRotaOf(r: EditableRoute): string {
  if (r.notes?.startsWith("Rota ")) return r.notes.slice(5);
  return r.code ?? "";
}

function isSentinelDate(value: string | null | undefined): boolean {
  if (!value) return true;
  return value.startsWith("3000-01-01") || value.startsWith("4000-01-01");
}

function initialDateValue(value: string | null | undefined): string {
  if (isSentinelDate(value)) return "";
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : "";
}

function formatYyyyMMdd(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}${iso[2]}${iso[3]}` : null;
}

type RouteEditDialogProps = {
  route: EditableRoute | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialCodErp?: string | null;
  onSuccess?: () => void;
};

export function RouteEditDialog({
  route,
  open,
  onOpenChange,
  initialCodErp,
  onSuccess,
}: RouteEditDialogProps) {
  const qc = useQueryClient();
  const listar = useServerFn(listarResponsaveisErp);
  const atualizar = useServerFn(atualizarCapaRotaErp);

  const [dateValue, setDateValue] = useState<string>("");
  const [nome, setNome] = useState<string>("");
  const [selectedCod, setSelectedCod] = useState<string | null>(null);
  const [comboOpen, setComboOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const responsaveisQ = useQuery({
    queryKey: ["responsaveis-erp"],
    queryFn: () => listar(),
    staleTime: 5 * 60 * 1000,
    enabled: open,
  });

  const responsaveis = responsaveisQ.data ?? [];

  const selected = useMemo(
    () => responsaveis.find((r) => r.codErp === selectedCod) ?? null,
    [responsaveis, selectedCod],
  );

  // Sincroniza estado local quando a rota mudar / o diálogo abrir.
  useMemo(() => {
    if (open && route) {
      setDateValue(initialDateValue(route.route_date));
      setNome(nomeRotaOf(route));
      setSelectedCod(initialCodErp?.trim() || null);
    }
  }, [open, route, initialCodErp]);

  const canSave = nome.trim().length > 0 && !saving;

  const handleSave = async () => {
    if (!route || !route.erp_route_id) return;
    setSaving(true);
    try {
      const id = Number(route.erp_route_id);
      const dtYyyyMMdd = formatYyyyMMdd(dateValue);
      const nomeRota = nome.trim().toUpperCase();
      const nomeMotorista = selected?.razaoSocial ?? null;
      const codFrtTrp = selected?.codErp ?? null;
      const status = route.erp_status?.trim() || "P";

      await atualizar({
        data: {
          id,
          dtPrevExpYyyyMMdd: dtYyyyMMdd,
          nomeRota,
          nomeMotorista,
          codFrtTrp,
          status,
        },
      });

      let carrierId: string | null = null;
      if (codFrtTrp) {
        const { data: fc } = await supabase
          .from("freight_carriers")
          .select("id, transportadoras!inner(cod_erp)")
          .eq("transportadoras.cod_erp", codFrtTrp)
          .maybeSingle();
        carrierId = (fc as { id?: string } | null)?.id ?? null;
      }

      const { error } = await supabase
        .from("routes")
        .update({
          route_date: dateValue || null,
          notes: `Rota ${nomeRota}`,
          driver_name: nomeMotorista,
          carrier_id: carrierId,
          erp_status: status,
        })
        .eq("id", route.id);
      if (error) throw error;

      toast.success("Rota atualizada no ERP e no app");
      qc.invalidateQueries({ queryKey: ["routes"] });
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar rota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar rota</DialogTitle>
          <DialogDescription>
            Altere a capa da rota no ERP. O nome é obrigatório; data e responsável são opcionais.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Data prevista</Label>
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nome da rota *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value.toUpperCase())}
              placeholder="Ex: ROTA CENTRO"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Transportadora / fretista</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between font-normal"
                  disabled={responsaveisQ.isLoading}
                >
                  <span className="truncate">
                    {selected ? `${selected.razaoSocial} (${selected.codErp})` : "Selecione..."}
                  </span>
                  <div className="flex items-center gap-1">
                    {selected && (
                      <span
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCod(null);
                        }}
                      >
                        <X className="h-4 w-4" />
                      </span>
                    )}
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command filter={responsavelFilter}>
                  <CommandInput placeholder="Buscar por razão social ou código ERP..." />
                  <CommandList>
                    <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                    <CommandGroup>
                      {responsaveis.map((r) => (
                        <CommandItem
                          key={r.codErp}
                          value={`${r.razaoSocial} ${r.codErp}`}
                          onSelect={() => {
                            setSelectedCod(r.codErp);
                            setComboOpen(false);
                          }}
                        >
                          <span className="flex-1 truncate">
                            {r.razaoSocial} <span className="text-muted-foreground">({r.codErp})</span>
                          </span>
                          {selectedCod === r.codErp && (
                            <Check className="ml-2 h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {responsaveisQ.isLoading && (
              <p className="text-xs text-muted-foreground">Carregando responsáveis...</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {saving && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function responsavelFilter(value: string, search: string, keywords?: string[]): number {
  const term = search.toLowerCase();
  const haystack = [value, ...(keywords ?? [])].join(" ").toLowerCase();
  return haystack.includes(term) ? 1 : 0;
}
