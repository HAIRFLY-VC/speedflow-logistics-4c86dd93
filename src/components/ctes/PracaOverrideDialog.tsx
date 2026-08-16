import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { criterioFreteCte, definirPracaMunicipio } from "@/lib/frete-area.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const origemLabel: Record<string, string> = {
  aprendido: "definida pelo usuário",
  mapa: "mapa de municípios",
  nome: "nome da praça",
};

/**
 * Permite corrigir a praça (faixa da tabela de frete) usada na auditoria.
 * A escolha fica vinculada ao município de entrega e é reaproveitada nos
 * próximos CT-e daquela localidade.
 */
export function PracaOverrideDialog({
  cteId,
  onSaved,
}: {
  cteId: string;
  onSaved?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const qc = useQueryClient();

  const carregar = useServerFn(criterioFreteCte);
  const salvar = useServerFn(definirPracaMunicipio);

  const { data, isLoading } = useQuery({
    queryKey: ["cte-criterio", cteId],
    queryFn: () => carregar({ data: { cteId } }),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (rotaId: string) =>
      salvar({ data: { cteId, rotaId, municipio: data?.municipio ?? "" } }),
    onSuccess: () => {
      toast.success("Critério ajustado — auditoria recalculada e regra memorizada.");
      qc.invalidateQueries({ queryKey: ["cte-criterio", cteId] });
      onSaved?.();
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível ajustar o critério"),
  });

  const atual = selecionada ?? data?.rotaAtualId ?? null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MapPin className="mr-1 h-4 w-4" />
          Alterar critério da praça
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Critério de cálculo da auditoria</DialogTitle>
          <DialogDescription>
            Escolha a praça da tabela de frete correta para este endereço de entrega. O app passa
            a usar essa praça automaticamente nas próximas entregas do mesmo município.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-6 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando critérios...
          </div>
        ) : !data?.tabelaId ? (
          <p className="text-muted-foreground py-6 text-sm">
            Nenhuma tabela de frete vigente foi encontrada para esta transportadora.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="text-muted-foreground text-xs">
              Município de entrega:{" "}
              <span className="text-foreground font-medium">{data.municipio ?? "não identificado"}</span>
              {data.ufDestino ? ` / ${data.ufDestino}` : ""} · Tabela{" "}
              <span className="text-foreground font-medium">{data.tabelaNome}</span>
              {data.origemRota ? ` · praça atual escolhida por ${origemLabel[data.origemRota] ?? data.origemRota}` : ""}
            </div>

            {data.rotas.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Esta tabela não possui praças cadastradas (cálculo por faixa de peso/percentual).
              </p>
            ) : (
              <div className="max-h-[45vh] space-y-1.5 overflow-y-auto pr-1">
                {data.rotas.map((r) => {
                  const ativo = atual === r.id;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelecionada(r.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-xs transition ${
                        ativo ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.destino}</span>
                        {r.aprendida ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-500/40 text-[9px] text-emerald-600"
                          >
                            aprendida
                          </Badge>
                        ) : null}
                        {ativo ? (
                          <Badge className="ml-auto text-[9px]">selecionada</Badge>
                        ) : null}
                      </div>
                      <div className="text-muted-foreground mt-0.5">
                        origem {r.origem} · {brl(r.tarifa_frete_peso)}/kg ·{" "}
                        {r.frete_valor_percentual}% do valor · despacho {brl(r.taxa_despacho)} ·
                        mínimo {brl(r.frete_minimo)}
                        {r.peso_minimo_kg ? ` · peso mín. ${r.peso_minimo_kg} kg` : ""}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!atual || !data?.municipio || mutation.isPending}
            onClick={() => atual && mutation.mutate(atual)}
          >
            {mutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Salvar e reauditar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
