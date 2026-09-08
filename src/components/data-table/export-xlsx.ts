/** Exportação simples para .xlsx no navegador (carregada sob demanda). */

export type LinhaExport = Array<string | number | null>;

export async function exportarXlsx(opts: {
  fileName: string;
  sheetName?: string;
  headers: string[];
  rows: LinhaExport[];
  /** Linha final opcional com totais. */
  footer?: LinhaExport;
}) {
  const XLSX = await import("xlsx");
  const dados: LinhaExport[] = [opts.headers, ...opts.rows];
  if (opts.footer) dados.push(opts.footer);

  const ws = XLSX.utils.aoa_to_sheet(dados);
  ws["!cols"] = opts.headers.map((h, idx) => {
    const largura = Math.max(
      h.length,
      ...dados.slice(1, 200).map((r) => String(r[idx] ?? "").length),
    );
    return { wch: Math.min(40, Math.max(8, largura + 2)) };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName ?? "Dados");
  XLSX.writeFile(wb, opts.fileName);
}

export function nomeArquivoComData(base: string) {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes(),
  )}.xlsx`;
}
