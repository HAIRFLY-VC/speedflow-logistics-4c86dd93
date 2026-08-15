import { FileCode, FileDown, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CteDetailView } from "./CteDetailView";
import type { Tables } from "@/integrations/supabase/types";

type Cte = Tables<"ctes">;

export function CteDetailDialog({
  cte,
  open,
  onOpenChange,
  transportadoraNome,
  statusTone,
  onDownloadXml,
  onReadXml,
  downloading,
  onOpenCte,
}: {
  cte: Cte | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transportadoraNome?: string;
  statusTone?: string;
  onDownloadXml: (cte: Cte) => void;
  onReadXml: (cte: Cte) => void;
  downloading: boolean;
  onOpenCte?: (cteId: string) => void;
}) {
  if (!cte) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            CT-e {cte.numero ?? "—"}
            {cte.serie ? <span className="text-muted-foreground">/{cte.serie}</span> : null}
            <Badge
              variant="secondary"
              className={statusTone ?? "bg-muted text-muted-foreground"}
            >
              {cte.status.replaceAll("_", " ")}
            </Badge>
          </DialogTitle>
          <DialogDescription className="font-mono text-[11px] break-all">
            {cte.chave_acesso}
          </DialogDescription>
        </DialogHeader>

        <CteDetailView
          cte={cte}
          transportadoraNome={transportadoraNome}
          statusTone={statusTone}
          onDownloadXml={onDownloadXml}
          onReadXml={onReadXml}
          downloading={downloading}
          onOpenCte={onOpenCte}
          linkMode="dialog"
        />

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            disabled={!cte.xml_storage_path}
            onClick={() => onReadXml(cte)}
          >
            <FileCode className="mr-1 h-4 w-4" />
            Ler XML
          </Button>
          <Button
            variant="outline"
            disabled={!cte.xml_storage_path || downloading}
            onClick={() => onDownloadXml(cte)}
          >
            {downloading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1 h-4 w-4" />
            )}
            Baixar XML
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
