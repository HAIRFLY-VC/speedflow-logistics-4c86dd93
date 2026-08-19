import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { openAppRoute } from "@/lib/open-in-tab";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileCode, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/central/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CteDetailView } from "@/components/ctes/CteDetailView";
import { XmlViewerDialog } from "@/components/ctes/XmlViewerDialog";
import { getCteXmlUrl } from "@/lib/cte.functions";
import { getStatusErpCtes } from "@/lib/cte-status-erp.functions";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/ctes/$cteId")({
  component: CteDetailPage,
  head: () => ({
    meta: [
      { title: "Detalhamento do CT-e | SpeedFlow Logistics" },
      {
        name: "description",
        content: "Detalhamento completo do Conhecimento de Transporte Eletrônico.",
      },
      { property: "og:title", content: "Detalhamento do CT-e | SpeedFlow Logistics" },
      { property: "og:description", content: "Dados, auditoria e histórico do CT-e." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const STATUS_TONE: Record<string, string> = {
  RECEBIDO: "bg-blue-500/10 text-blue-600",
  PENDENTE_IDENTIFICACAO: "bg-amber-500/10 text-amber-600",
  EM_AUDITORIA: "bg-blue-500/10 text-blue-600",
  APROVADO: "bg-emerald-500/10 text-emerald-600",
  DIVERGENTE: "bg-destructive/10 text-destructive",
  EM_RESOLUCAO: "bg-amber-500/10 text-amber-600",
  RESOLVIDO: "bg-emerald-500/10 text-emerald-600",
  AUTORIZADO: "bg-emerald-500/10 text-emerald-600",
  LANCADO_ERP: "bg-emerald-500/10 text-emerald-600",
  ERRO_ERP: "bg-destructive/10 text-destructive",
  REJEITADO: "bg-destructive/10 text-destructive",
};

type Cte = Tables<"ctes">;

export default function CteDetailPage() {
  const { cteId } = Route.useParams();
  const qc = useQueryClient();
  const router = useRouter();

  const signUrl = useServerFn(getCteXmlUrl);

  const [xmlOpen, setXmlOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlTitle, setXmlTitle] = useState("XML do CT-e");
  const [xmlLoading, setXmlLoading] = useState(false);

  const { data: cte, isLoading } = useQuery({
    queryKey: ["cte", cteId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ctes").select("*").eq("id", cteId).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("CT-e não encontrado");
      return data as Cte;
    },
  });

  const { data: transportadora } = useQuery({
    queryKey: ["transportadora", cte?.transportadora_id],
    enabled: !!cte?.transportadora_id,
    queryFn: async () => {
      const id = cte!.transportadora_id!;
      const { data, error } = await supabase
        .from("transportadoras")
        .select("razao_social")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (cte) {
      document.title = `CT-e ${cte.numero ?? cteId} | SpeedFlow Logistics`;
    }
  }, [cte, cteId]);

  const handleReadXml = async (c: Cte) => {
    setXmlTitle(`XML do CT-e ${c.numero ?? ""}`.trim());
    setXmlContent(null);
    setXmlOpen(true);
    setXmlLoading(true);
    try {
      const { xml } = await signUrl({ data: { cteId: c.id } });
      setXmlContent(xml);
    } catch (e) {
      setXmlOpen(false);
      toast.error(e instanceof Error ? e.message : "Erro ao carregar XML");
    } finally {
      setXmlLoading(false);
    }
  };

  const handleDownloadXml = async (c: Cte) => {
    try {
      const { xml } = await signUrl({ data: { cteId: c.id } });
      const blob = new Blob([xml], { type: "application/xml" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `cte-${c.numero ?? c.id}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao baixar XML");
    }
  };

  const openCteInWindow = (id: string) => {
    openAppRoute(router, `/ctes/${id}`);
  };


  return (
    <AppShell>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/ctes">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para CT-e
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">
              CT-e {cte?.numero ?? "—"}
              {cte?.serie ? <span className="text-muted-foreground">/{cte.serie}</span> : null}
              {cte ? (
                <Badge
                  variant="secondary"
                  className={`ml-2 ${STATUS_TONE[cte.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {cte.status.replaceAll("_", " ")}
                </Badge>
              ) : null}
            </h1>
            <p className="text-muted-foreground font-mono text-[11px] break-all">
              {cte?.chave_acesso ?? cteId}
            </p>
          </div>

          {cte ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!cte.xml_storage_path}
                onClick={() => handleReadXml(cte)}
              >
                <FileCode className="mr-1 h-4 w-4" /> Ler XML
              </Button>
              <Button
                variant="outline"
                disabled={!cte.xml_storage_path}
                onClick={() => handleDownloadXml(cte)}
              >
                <FileDown className="mr-1 h-4 w-4" /> Baixar XML
              </Button>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : !cte ? (
          <div className="rounded-md border p-8 text-center text-muted-foreground">
            CT-e não encontrado.
          </div>
        ) : (
          <CteDetailView
            cte={cte}
            transportadoraNome={transportadora?.razao_social}
            statusTone={STATUS_TONE[cte.status]}
            onDownloadXml={handleDownloadXml}
            onReadXml={handleReadXml}
            downloading={false}
            onOpenCte={openCteInWindow}
            linkMode="window"
          />
        )}
      </div>

      <XmlViewerDialog
        open={xmlOpen}
        onOpenChange={setXmlOpen}
        xml={xmlContent}
        title={xmlTitle}
        loading={xmlLoading}
      />
    </AppShell>
  );
}
