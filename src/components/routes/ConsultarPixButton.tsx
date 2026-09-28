import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { sincronizarResponsaveisPorCodigo } from "@/lib/rota-erp.functions";
import { situacaoPixResponsaveis } from "@/lib/rota-pagamento.functions";

/** Força nova consulta do PIX do fretista no ERP e atualiza os dados do app. Nunca exibe a chave. */
export function ConsultarPixButton({ codErp }: { codErp: string }) {
  const qc = useQueryClient();
  const sync = useServerFn(sincronizarResponsaveisPorCodigo);
  const situacao = useServerFn(situacaoPixResponsaveis);
  const [loading, setLoading] = useState(false);

  const consultar = async () => {
    setLoading(true);
    try {
      const r = await sync({ data: { cods: [codErp] } });
      if (r.parcial) {
        toast.error("O ERP não respondeu. Tente novamente em instantes.");
        return;
      }
      await qc.invalidateQueries();
      let temPix: boolean | null = null;
      try {
        const res = (await situacao({ data: { cods: [codErp] } } as never)) as unknown;
        const lista = Array.isArray(res) ? res : Object.values((res ?? {}) as object);
        const s = lista.find((x: any) => x?.cod_erp === codErp) as { pix?: string | null } | undefined;
        if (s) temPix = Boolean(s.pix);
      } catch {
        /* sem verificação extra */
      }
      if (temPix === false) toast.error(`O ERP continua sem PIX para o fretista (código ${codErp}).`);
      else toast.success("Cadastro do fretista atualizado a partir do ERP.");
    } catch {
      toast.error("Não foi possível consultar o ERP. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" disabled={loading} onClick={consultar}>
      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
      {loading ? "Consultando ERP..." : "Consultar PIX no ERP"}
    </Button>
  );
}
