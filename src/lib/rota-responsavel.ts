import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/central/client";
import {
  listarResponsaveisDeRotasErp,
  listarNaturezasPorCodigoErp,
  type ResponsavelErp,
} from "@/lib/rota-erp.functions";

export type TipoFrete = "F" | "T" | "P";

export const TIPO_FRETE_LABEL: Record<TipoFrete, string> = {
  F: "Fretista",
  T: "Transportadora",
  P: "Frota própria",
};

export const TIPO_FRETE_TONE: Record<TipoFrete, string> = {
  F: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  T: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  P: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

export function normalizaCod(v: string | null | undefined): string {
  return String(v ?? "").trim().replace(/^0+/, "");
}

export function normalizaNome(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Nome da rota gravado em `notes` no formato "Rota X". */
export function nomeRotaDeNotes(notes: string | null | undefined, code: string): string {
  return notes?.startsWith("Rota ") ? notes.slice(5) : code;
}

/**
 * Resolve o responsável (fretista/transportadora) de uma única rota:
 * código do responsável no ERP → espelho local → natureza por código no ERP.
 * Falhas do ERP não quebram a tela: retorna `null` e o chamador usa o nome
 * que veio na própria rota.
 */
export function useResponsavelRota(args: {
  erpRouteId: string | null | undefined;
  codErpFallback?: string | null;
}) {
  const idRota = Number(args.erpRouteId);
  const temId = Number.isFinite(idRota) && idRota > 0;

  const listarCods = useServerFn(listarResponsaveisDeRotasErp);
  const codQ = useQuery({
    queryKey: ["rotas-responsaveis-erp", temId ? [idRota] : []],
    queryFn: () => listarCods({ data: { idsRota: [idRota] } }),
    enabled: temId,
    staleTime: 60 * 1000,
  });

  const cod = useMemo(() => {
    const doErp = temId ? codQ.data?.[String(idRota)] : undefined;
    const escolhido = doErp ?? args.codErpFallback ?? null;
    return escolhido && String(escolhido).trim() ? String(escolhido).trim() : null;
  }, [codQ.data, temId, idRota, args.codErpFallback]);

  const locaisQ = useQuery({
    queryKey: ["erp-responsaveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("erp_responsaveis")
        .select("cod_erp,razao_social,natureza,tipo_frete")
        .order("razao_social");
      if (error) throw error;
      return (data ?? []) as {
        cod_erp: string;
        razao_social: string | null;
        natureza: string | null;
        tipo_frete: TipoFrete | null;
      }[];
    },
    staleTime: 30 * 60 * 1000,
  });

  const listarNaturezas = useServerFn(listarNaturezasPorCodigoErp);
  const naturezaQ = useQuery({
    queryKey: ["naturezas-erp", cod ? [cod] : []],
    queryFn: () => listarNaturezas({ data: { cods: cod ? [cod] : [] } }),
    enabled: Boolean(cod),
    staleTime: 5 * 60 * 1000,
  });

  const responsavel = useMemo<ResponsavelErp | null>(() => {
    if (!cod) return null;
    const local = (locaisQ.data ?? []).find(
      (item) => normalizaCod(item.cod_erp) === normalizaCod(cod) && item.tipo_frete,
    );
    if (local?.tipo_frete) {
      return {
        razaoSocial: local.razao_social ?? `Código ${local.cod_erp}`,
        codErp: local.cod_erp,
        tipoFrete: local.tipo_frete,
      };
    }
    const natureza = Object.values(naturezaQ.data ?? {}).find(
      (n) => normalizaCod(n.codErp) === normalizaCod(cod),
    );
    if (natureza?.razaoSocial) {
      return {
        razaoSocial: natureza.razaoSocial,
        codErp: natureza.codErp,
        tipoFrete: (natureza.tipoFrete as TipoFrete | null) ?? "T",
      };
    }
    return null;
  }, [cod, locaisQ.data, naturezaQ.data]);

  return {
    cod,
    responsavel,
    isLoading: codQ.isFetching || locaisQ.isFetching || naturezaQ.isFetching,
  };
}
