import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/central/client";
import { checkErpConfig, triggerErpSync } from "@/lib/erp.functions";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ErpSyncButton() {
  const qc = useQueryClient();
  const checkFn = useServerFn(checkErpConfig);
  const syncFn = useServerFn(triggerErpSync);

  const cfgQ = useQuery({
    queryKey: ["erp", "config"],
    queryFn: () => checkFn(),
    staleTime: 60_000,
  });

  const lastSyncQ = useQuery({
    queryKey: ["erp", "last-sync"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_sync_runs")
        .select("started_at, finished_at, status")
        .eq("status", "success")
        .order("finished_at", { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      return data as { started_at: string; finished_at: string; status: string } | null;
    },
    staleTime: 30_000,
  });

  type SyncOutcome = {
    created: number;
    updated: number;
    skipped: number;
    errors: unknown[];
  };

  const sync = useMutation({
    mutationFn: async (): Promise<SyncOutcome> => {
      const clickedAt = new Date(Date.now() - 5_000).toISOString();
      try {
        return await syncFn();
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        if (!isConnectionDrop(err.message)) throw err;
        // A requisição caiu, mas o servidor pode ter continuado: acompanha o histórico.
        const finished = await waitForRun(clickedAt);
        if (finished) return finished;
        throw new Error(
          "A conexão caiu e a sincronização não terminou em 2 minutos. Verifique o histórico mais tarde.",
        );
      }
    },
    onSuccess: async (r) => {
      toast.success(
        `ERP: ${r.created} criado(s), ${r.updated} atualizado(s), ${r.skipped} ignorado(s)` +
          (r.errors.length ? ` — ${r.errors.length} erro(s)` : ""),
      );
      await qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["routes"] });
      qc.invalidateQueries({ queryKey: ["erp", "last-sync"] });
    },
    onError: (e: Error) => toast.error(`Falha ao importar: ${e.message}`),
  });

  function isConnectionDrop(message: string): boolean {
    const m = message.toLowerCase();
    return (
      m.includes("502") ||
      m.includes("504") ||
      m.includes("internal server error") ||
      m.includes("failed to fetch") ||
      m.includes("load failed") ||
      m.includes("network") ||
      m.includes("aborted") ||
      m.includes("unexpected token") ||
      m.includes("json")
    );
  }

  async function waitForRun(sinceIso: string): Promise<SyncOutcome | null> {
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline) {
      const { data } = await supabase
        .from("erp_sync_runs")
        .select("finished_at, status, orders_created, orders_updated, orders_skipped, errors")
        .gte("started_at", sinceIso)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.finished_at) {
        if (data.status === "failed" && !data.orders_created && !data.orders_updated) {
          const errs = (data.errors as { message?: string }[] | null) ?? [];
          throw new Error(errs[0]?.message ?? "A sincronização falhou.");
        }
        return {
          created: data.orders_created ?? 0,
          updated: data.orders_updated ?? 0,
          skipped: data.orders_skipped ?? 0,
          errors: (data.errors as unknown[] | null) ?? [],
        };
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
    return null;
  }

  if (cfgQ.isLoading || !cfgQ.data) return null;
  if (!cfgQ.data.allowed) return null;

  const ready = cfgQ.data.ready;
  const missing: string[] = [];
  if (!cfgQ.data.hasBaseUrl) missing.push("ERP_API_BASE_URL");
  if (!cfgQ.data.hasApiKey) missing.push("ERP_API_KEY (API Key)");
  const tooltip = ready
    ? "Sincronizar pedidos do ERP"
    : `Configuração incompleta: ${missing.join(", ")}`;

  const lastSyncText = lastSyncQ.data?.finished_at
    ? `Última sinc.: ${formatDistanceToNow(new Date(lastSyncQ.data.finished_at), { addSuffix: true, locale: ptBR })}`
    : "Nenhuma sincronização";

  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => sync.mutate()}
      disabled={!ready || sync.isPending}
    >
      {sync.isPending ? (
        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4 mr-1" />
      )}
      Sync ERP
    </Button>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex flex-col items-center gap-0.5">
            <span>{btn}</span>
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
              {lastSyncText}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
