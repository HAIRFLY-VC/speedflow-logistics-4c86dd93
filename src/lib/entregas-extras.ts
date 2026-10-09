/** Campos extras de A_GERENTREGAS (v1.33.0; `vendedor` desde v1.37.4). Gravados só se a coluna existir no banco central. */
export const CAMPOS_EXTRAS_ENTREGA = [
  "dt_etrg_trsp", "cod_transp_prn", "tipo_transp_pn", "vlr_frete", "vlr_perna",
  "vlr_diaria", "vlr_pernoite", "vlr_reentrega", "vlr_descarrego", "vendedor",
] as const;

export const SQL_EXTRAS_ENTREGA =
  "G.DT_ETRG_TRSP, G.COD_TRANSP_PRN, G.TIPO_TRANSP_PN, G.VLR_FRETE, G.VLR_PERNA, G.VLR_DIARIA, G.VLR_PERNOITE, G.VLR_REENTREGA, G.VLR_DESCARREGO";

export function extrasEntrega(get: (k: string) => unknown, data: (v: unknown) => string | null) {
  const t = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());
  const n = (v: unknown) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    dt_etrg_trsp: data(get("DT_ETRG_TRSP")),
    cod_transp_prn: t(get("COD_TRANSP_PRN")),
    tipo_transp_pn: t(get("TIPO_TRANSP_PN")),
    vlr_frete: n(get("VLR_FRETE")),
    vlr_perna: n(get("VLR_PERNA")),
    vlr_diaria: n(get("VLR_DIARIA")),
    vlr_pernoite: n(get("VLR_PERNOITE")),
    vlr_reentrega: n(get("VLR_REENTREGA")),
    vlr_descarrego: n(get("VLR_DESCARREGO")),
  };
}

/** Remove os campos extras (para quando o script do banco central ainda não rodou). */
export function semExtras<T extends Record<string, unknown>>(r: T): T {
  const c = { ...r };
  for (const k of CAMPOS_EXTRAS_ENTREGA) delete c[k];
  return c;
}

export const erroColunaAusente = (msg: string) =>
  CAMPOS_EXTRAS_ENTREGA.some((k) => msg.includes(k));
