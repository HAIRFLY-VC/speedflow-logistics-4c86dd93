import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { atribuirResponsavelRota, listarResponsaveisErp } from "@/lib/rota-erp.functions";

/** Botão para Adm/Gestor atribuir o responsável de uma rota (grava no ERP e no app). */
export function AtribuirResponsavel({ routeId, nomeRota }: { routeId: string; nomeRota: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listarFn = useServerFn(listarResponsaveisErp);
  const atribuirFn = useServerFn(atribuirResponsavelRota);

  const listaQ = useQuery({
    queryKey: ["responsaveis-erp-atribuir"],
    enabled: open,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const res = (await listarFn()) as unknown;
      const arr = (Array.isArray(res) ? res : ((res as { responsaveis?: unknown[] })?.responsaveis ?? [])) as {
        razaoSocial: string;
        codErp: string;
        tipoFrete: "P" | "F" | "T";
      }[];
      return arr.map((r) => ({ razaoSocial: r.razaoSocial, codErp: r.codErp, tipoFrete: r.tipoFrete }));
    },
  });

  const salvar = useMutation({
    mutationFn: (r: { codErp: string; razaoSocial: string }) =>
      atribuirFn({ data: { routeId, nomeRota, codErp: r.codErp, nome: r.razaoSocial } }),
    onSuccess: () => {
      toast.success("Responsável atribuído e atualizado no ERP.");
      setOpen(false);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={salvar.isPending}>
          {salvar.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4 mr-1" />
          )}
          Atribuir responsável
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar por nome ou código..." />
          <CommandList>
            {listaQ.isLoading ? (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
              </div>
            ) : listaQ.isError ? (
              <div className="p-3 text-sm text-destructive">{(listaQ.error as Error).message}</div>
            ) : (
              <>
                <CommandEmpty>Nenhum responsável encontrado.</CommandEmpty>
                <CommandGroup>
                  {(listaQ.data ?? []).map((r) => (
                    <CommandItem
                      key={r.codErp}
                      value={`${r.codErp} ${r.razaoSocial}`}
                      onSelect={() => salvar.mutate(r)}
                    >
                      <span className="font-mono text-xs text-muted-foreground mr-2">{r.codErp}</span>
                      <span className="flex-1 truncate">{r.razaoSocial}</span>
                      <span className="ml-2 rounded border px-1.5 text-xs">{r.tipoFrete}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
