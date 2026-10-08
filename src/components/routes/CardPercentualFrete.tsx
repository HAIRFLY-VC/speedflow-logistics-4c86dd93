import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { calendarioComercialQueryOptions, cicloAtual, custoFreteQueryOptions, resumir } from "@/lib/custo-frete.query";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dia = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** % do frete confirmado sobre os pedidos faturados no ciclo comercial atual. */
export function CardPercentualFrete() {
  const calQ = useQuery(calendarioComercialQueryOptions());
  const ciclo = cicloAtual(calQ.data ?? []);
  const q = useQuery(custoFreteQueryOptions(ciclo));
  const r = resumir(q.data ?? []);
  const carregando = calQ.isLoading || q.isLoading;

  return (
    <Link
      to="/custo-frete"
      className="col-span-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:col-span-1"
      aria-label="Abrir painel de custo de frete"
    >
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="flex flex-row items-start justify-between gap-2 p-3 pb-1 space-y-0">
          <CardTitle className="text-xs font-medium leading-tight sm:text-sm">
            % Frete do ciclo
            {ciclo && <span className="block text-[11px] font-normal text-muted-foreground">{dia(ciclo.de)} a {dia(ciclo.ate)}</span>}
          </CardTitle>
          {carregando ? <Percent className="h-4 w-4 text-muted-foreground" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}
        </CardHeader>
        <CardContent className="p-3 pt-0">
          {q.isError || calQ.isError ? (
            <p className="text-xs text-muted-foreground">Não foi possível calcular.</p>
          ) : (
            <>
              <div className="text-base font-bold tabular-nums sm:text-xl">
                {carregando ? "…" : r.pct == null ? "—" : `${r.pct.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`}
              </div>
              {!carregando && (
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {brl.format(r.frete)} / {brl.format(r.valor)}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
