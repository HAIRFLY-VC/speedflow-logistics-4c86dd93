import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Copy, Download, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCapturaCteStatus } from "@/lib/configuracoes-fretes.functions";

export const Route = createFileRoute("/_authenticated/captura-cte")({
  component: CapturaCtePage,
  head: () => ({
    meta: [
      { title: "Captura de CT-e | SpeedFlow Logistics" },
      {
        name: "description",
        content:
          "Configure o envio automático dos XMLs de CT-e capturados na SEFAZ com certificado A1 e acompanhe os recebimentos.",
      },
      { property: "og:title", content: "Captura de CT-e | SpeedFlow Logistics" },
      {
        property: "og:description",
        content: "Endpoint de ingestão de CT-e, guia do robô SEFAZ e histórico de recebimentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const PROD_BASE = "https://project--0f575c65-0542-477f-8d03-b4c26e47b952.lovable.app";
const PATH = "/api/public/hooks/ingest-cte";

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
        <code>{children}</code>
      </pre>
      <Button
        size="sm"
        variant="ghost"
        className="absolute right-1 top-1 h-7 px-2"
        onClick={() => {
          void navigator.clipboard.writeText(children);
          toast.success("Copiado");
        }}
      >
        <Copy className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR");
}

function resultadoBadge(r: string) {
  if (r === "CRIADO") return <Badge className="bg-emerald-600 hover:bg-emerald-600">Criado</Badge>;
  if (r === "DUPLICADO") return <Badge variant="secondary">Duplicado</Badge>;
  return <Badge variant="destructive">Erro</Badge>;
}

function CapturaCtePage() {
  const { role, loading } = useAuth();
  const fetchStatus = useServerFn(getCapturaCteStatus);
  const [origin] = useState(() => (typeof window !== "undefined" ? window.location.origin : PROD_BASE));

  const status = useQuery({
    queryKey: ["captura-cte-status"],
    queryFn: () => fetchStatus(),
    enabled: role === "adm",
    refetchInterval: 60_000,
  });

  const curl = useMemo(
    () =>
      `curl -X POST "${PROD_BASE}${PATH}" \\\n  -H "x-ingest-secret: $CTE_INGEST_SECRET" \\\n  -H "Content-Type: application/xml" \\\n  --data-binary @cte.xml`,
    [],
  );

  if (loading) {
    return (
      <AppShell>
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </AppShell>
    );
  }

  if (role !== "adm") {
    return (
      <AppShell>
        <div className="space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Captura de CT-e</h1>
          <p className="text-muted-foreground">Apenas administradores podem acessar esta tela.</p>
        </div>
      </AppShell>
    );
  }

  const d = status.data;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Captura de CT-e</h1>
            <p className="text-sm text-muted-foreground">
              Envio automático dos XMLs capturados na SEFAZ com certificado A1.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/configuracoes-fretes">Config. de fretes</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => void status.refetch()}>
              {status.isFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Atualizar
            </Button>
          </div>
        </div>

        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex gap-3 pt-6 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-medium">O certificado A1 não é instalado dentro do aplicativo.</p>
              <p className="text-muted-foreground">
                O webservice de Distribuição DFe da SEFAZ exige conexão TLS mútua com o certificado, o que o
                ambiente do aplicativo não permite. O A1 de cada empresa do grupo fica no seu robô, rodando na
                sua infraestrutura, e ele envia cada XML para o endpoint abaixo.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Segredo de envio</CardTitle>
            </CardHeader>
            <CardContent>
              {d?.segredoConfigurado ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Configurado</span>
                </div>
              ) : (
                <span className="text-sm font-semibold text-destructive">Não configurado</span>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Recebidos (24h)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{d?.total24h ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Recebidos (7 dias)</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{d?.total7d ?? "—"}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Erros (7 dias)</CardTitle>
            </CardHeader>
            <CardContent
              className={`text-2xl font-bold ${d?.erros7d ? "text-destructive" : ""}`}
            >
              {d?.erros7d ?? "—"}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Endpoint de ingestão
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">URL de produção</p>
              <CodeBlock>{`${PROD_BASE}${PATH}`}</CodeBlock>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">URL do ambiente atual (testes)</p>
              <CodeBlock>{`${origin}${PATH}`}</CodeBlock>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>
                Método <strong>POST</strong>, um CT-e por requisição.
              </li>
              <li>
                Cabeçalho <code className="rounded bg-muted px-1">x-ingest-secret</code> com o valor do segredo{" "}
                <code className="rounded bg-muted px-1">CTE_INGEST_SECRET</code> (ou{" "}
                <code className="rounded bg-muted px-1">Authorization: Bearer &lt;segredo&gt;</code>).
              </li>
              <li>
                Corpo: XML puro (<code className="rounded bg-muted px-1">application/xml</code>) ou JSON{" "}
                <code className="rounded bg-muted px-1">{'{ "xml": "..." }'}</code>.
              </li>
              <li>Chave duplicada é ignorada com segurança — o robô pode reenviar sem risco.</li>
            </ul>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Exemplo</p>
              <CodeBlock>{curl}</CodeBlock>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" /> Guia do robô SEFAZ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ol className="list-decimal space-y-2 pl-5">
              <li>
                Instale o certificado <strong>A1</strong> (arquivo .pfx) da empresa no servidor do robô e carregue-o
                em memória para assinar as requisições.
              </li>
              <li>
                Chame o serviço <code className="rounded bg-muted px-1">CTeDistribuicaoDFe</code> (ambiente
                nacional) com <code className="rounded bg-muted px-1">distDFeInt</code>, informando o CNPJ da
                empresa e o <strong>último NSU processado</strong>.
              </li>
              <li>
                Descompacte o conteúdo retornado (gZip + Base64) e filtre os documentos{" "}
                <code className="rounded bg-muted px-1">procCTe</code> — ignore resumos e eventos.
              </li>
              <li>Envie cada XML completo para o endpoint acima, um por requisição.</li>
              <li>
                Grave o <strong>maiorNSU</strong> retornado e repita o ciclo (sugestão: a cada 30 a 60 minutos,
                respeitando o intervalo mínimo da SEFAZ).
              </li>
              <li>Repita o processo para cada CNPJ do grupo, usando o certificado correspondente.</li>
            </ol>
            <p>
              O aplicativo identifica a transportadora pelo CNPJ do emitente e a empresa do grupo pelo CNPJ do
              destinatário — nenhuma configuração extra é necessária no robô além do segredo.
            </p>
          </CardContent>
        </Card>

        {d?.pendentes?.length ? (
          <Card className="border-amber-500/40">
            <CardHeader>
              <CardTitle className="text-base">CT-e pendentes de identificação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Transportadora emitente ou empresa destinatária não cadastrada.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-left">Recebido</th>
                      <th className="py-2 text-left">Chave</th>
                      <th className="py-2 text-left">CNPJ emitente</th>
                      <th className="py-2 text-left">CNPJ destinatário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.pendentes.map((p) => (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2">{fmtDate(p.created_at)}</td>
                        <td className="py-2 font-mono">{p.chave_acesso}</td>
                        <td className="py-2">{p.cnpj_emitente ?? "—"}</td>
                        <td className="py-2">{p.cnpj_destinatario ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Últimos recebimentos{" "}
              <span className="text-xs font-normal text-muted-foreground">
                (último automático: {fmtDate(d?.ultimoAuto ?? null)})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status.isLoading ? (
              <div className="h-24 animate-pulse rounded bg-muted" />
            ) : d?.logs?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b">
                      <th className="py-2 text-left">Data</th>
                      <th className="py-2 text-left">Origem</th>
                      <th className="py-2 text-left">Resultado</th>
                      <th className="py-2 text-left">Chave</th>
                      <th className="py-2 text-left">Emitente</th>
                      <th className="py-2 text-left">Observação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.logs.map((l) => (
                      <tr key={l.id} className="border-b last:border-0">
                        <td className="py-2 whitespace-nowrap">{fmtDate(l.created_at)}</td>
                        <td className="py-2">{l.origem === "SEFAZ_AUTO" ? "Automático" : "Manual"}</td>
                        <td className="py-2">{resultadoBadge(l.resultado)}</td>
                        <td className="py-2 font-mono">{l.chave_acesso ?? "—"}</td>
                        <td className="py-2">{l.cnpj_emitente ?? "—"}</td>
                        <td className="py-2 text-muted-foreground">{l.mensagem ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum recebimento registrado ainda. Assim que o robô enviar o primeiro XML, ele aparece aqui.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
