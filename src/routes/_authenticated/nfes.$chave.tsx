import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileCode, FileDown, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { XmlViewerDialog } from "@/components/ctes/XmlViewerDialog";
import { getNfe, getNfeXmlUrl, uploadNfeXml } from "@/lib/nfe.functions";

export const Route = createFileRoute("/_authenticated/nfes/$chave")({
  component: NfeDetailPage,
  head: () => ({
    meta: [
      { title: "Detalhe da NF-e | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Detalhamento completo da nota fiscal eletrônica referenciada no CT-e, com leitura e download do XML.",
      },
      { property: "og:title", content: "Detalhe da NF-e | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Dados, itens e XML da nota fiscal eletrônica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 });

type NfeItem = {
  numero: number;
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  unidade: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="text-sm font-medium break-words">{value ?? "—"}</div>
    </div>
  );
}

function NfeDetailPage() {
  const { chave } = Route.useParams();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchNfe = useServerFn(getNfe);
  const signUrl = useServerFn(getNfeXmlUrl);
  const upload = useServerFn(uploadNfeXml);

  const [xmlOpen, setXmlOpen] = useState(false);
  const [xmlContent, setXmlContent] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["nfe", chave],
    queryFn: () => fetchNfe({ data: { chave } }),
  });

  const nfe = data?.nfe as
    | (Record<string, any> & { itens: NfeItem[] })
    | null
    | undefined;

  const readXml = useMutation({
    mutationFn: async () => {
      const { url } = await signUrl({ data: { chave } });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao carregar o XML");
      return res.text();
    },
    onMutate: () => {
      setXmlContent(null);
      setXmlOpen(true);
    },
    onSuccess: (xml) => setXmlContent(xml),
    onError: (e: Error) => {
      setXmlOpen(false);
      toast.error(e.message);
    },
  });

  const downloadXml = useMutation({
    mutationFn: async () => {
      const { url } = await signUrl({ data: { chave } });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Falha ao baixar o XML");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = `nfe-${nfe?.numero ?? chave}.xml`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importXml = useMutation({
    mutationFn: async (file: File) => upload({ data: { xml: await file.text() } }),
    onSuccess: (r) => {
      if (r.chave_acesso !== chave) {
        toast.warning("O XML importado é de outra NF-e; o registro foi salvo mesmo assim.");
      } else {
        toast.success("XML da NF-e importado");
      }
      qc.invalidateQueries({ queryKey: ["nfe", chave] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const itens = Array.isArray(nfe?.itens) ? (nfe!.itens as NfeItem[]) : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link to="/ctes">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para CT-e
              </Link>
            </Button>
            <h1 className="text-2xl font-semibold">
              NF-e {nfe?.numero ?? "—"}
              {nfe?.serie ? (
                <span className="text-muted-foreground">/{nfe.serie}</span>
              ) : null}
            </h1>
            <p className="text-muted-foreground font-mono text-[11px] break-all">{chave}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xml,text/xml,application/xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importXml.mutate(f);
              }}
            />
            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={importXml.isPending}
            >
              {importXml.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1 h-4 w-4" />
              )}
              Importar XML
            </Button>
            <Button
              variant="outline"
              onClick={() => readXml.mutate()}
              disabled={!nfe?.xml_storage_path || readXml.isPending}
            >
              <FileCode className="mr-1 h-4 w-4" /> Ler XML
            </Button>
            <Button
              onClick={() => downloadXml.mutate()}
              disabled={!nfe?.xml_storage_path || downloadXml.isPending}
            >
              {downloadXml.isPending ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="mr-1 h-4 w-4" />
              )}
              Baixar XML
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !nfe ? (
          <Card>
            <CardHeader>
              <CardTitle>NF-e ainda não importada</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-3 text-sm">
              <p>
                Esta nota fiscal está referenciada no CT-e, mas o XML dela ainda não foi
                enviado ao sistema. Use “Importar XML” para carregar o arquivo da NF-e e ver o
                detalhamento completo.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados gerais</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                <Field label="Natureza da operação" value={nfe.natureza_operacao ?? "—"} />
                <Field
                  label="Emissão"
                  value={
                    nfe.data_emissao
                      ? new Date(nfe.data_emissao).toLocaleString("pt-BR")
                      : "—"
                  }
                />
                <Field label="Emitente" value={nfe.nome_emitente ?? "—"} />
                <Field label="CNPJ emitente" value={nfe.cnpj_emitente ?? "—"} />
                <Field label="Destinatário" value={nfe.nome_destinatario ?? "—"} />
                <Field label="CNPJ destinatário" value={nfe.cnpj_destinatario ?? "—"} />
                <Field label="UF destino" value={nfe.uf_destino ?? "—"} />
                <Field
                  label="Peso bruto"
                  value={
                    nfe.peso_bruto == null
                      ? "—"
                      : `${Number(nfe.peso_bruto).toLocaleString("pt-BR")} kg`
                  }
                />
                <Field label="Valor dos produtos" value={brl(Number(nfe.valor_produtos))} />
                <Field label="Frete na nota" value={brl(Number(nfe.valor_frete))} />
                <Field label="Valor total da nota" value={brl(Number(nfe.valor_total))} />
                <Field label="Itens" value={itens.length} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Itens da nota</CardTitle>
              </CardHeader>
              <CardContent>
                {itens.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum item no XML.</p>
                ) : (
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="text-left">
                          <th className="px-3 py-2">#</th>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Descrição</th>
                          <th className="px-3 py-2">NCM</th>
                          <th className="px-3 py-2">CFOP</th>
                          <th className="px-3 py-2">Un.</th>
                          <th className="px-3 py-2 text-right">Qtd.</th>
                          <th className="px-3 py-2 text-right">Vl. unit.</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it) => (
                          <tr key={it.numero} className="border-t">
                            <td className="px-3 py-2">{it.numero}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {it.codigo ?? "—"}
                            </td>
                            <td className="px-3 py-2">{it.descricao}</td>
                            <td className="px-3 py-2 font-mono text-xs">{it.ncm ?? "—"}</td>
                            <td className="px-3 py-2 font-mono text-xs">{it.cfop ?? "—"}</td>
                            <td className="px-3 py-2">{it.unidade ?? "—"}</td>
                            <td className="px-3 py-2 text-right">{num(it.quantidade)}</td>
                            <td className="px-3 py-2 text-right">{brl(it.valor_unitario)}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              {brl(it.valor_total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <XmlViewerDialog
        open={xmlOpen}
        onOpenChange={setXmlOpen}
        xml={xmlContent}
        title={`XML da NF-e ${nfe?.numero ?? chave}`}
        loading={readXml.isPending}
      />
    </AppShell>
  );
}
