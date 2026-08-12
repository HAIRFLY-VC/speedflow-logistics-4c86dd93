import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExtractInput = {
  /** Texto extraído de planilha/CSV, quando houver */
  text?: string;
  /** Data URL (base64) para PDF ou imagem */
  dataUrl?: string;
  fileName?: string;
};

export type ExtractedTabela = {
  nome?: string | null;
  descricao?: string | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  tipo_calculo?: "peso" | "valor" | null;
  percentual_valor?: number | null;
  gris_percentual?: number | null;
  ad_valorem_percentual?: number | null;
  pedagio_valor?: number | null;
  tas_valor?: number | null;
  frete_minimo?: number | null;
  icms_percentual?: number | null;
  uf_destino?: string | null;
  transportadora_nome?: string | null;
  transportadora_cnpj?: string | null;
  faixas?: {
    peso_de?: number | null;
    peso_ate?: number | null;
    valor_por_kg?: number | null;
    valor_fixo_faixa?: number | null;
  }[];
};

const SCHEMA = {
  type: "object",
  properties: {
    nome: { type: "string" },
    descricao: { type: "string" },
    data_inicio: { type: "string", description: "YYYY-MM-DD" },
    data_fim: { type: "string", description: "YYYY-MM-DD" },
    tipo_calculo: { type: "string", enum: ["peso", "valor"] },
    percentual_valor: { type: "number" },
    gris_percentual: { type: "number" },
    ad_valorem_percentual: { type: "number" },
    pedagio_valor: { type: "number" },
    tas_valor: { type: "number" },
    frete_minimo: { type: "number" },
    icms_percentual: { type: "number" },
    uf_destino: { type: "string" },
    transportadora_nome: { type: "string" },
    transportadora_cnpj: { type: "string" },
    faixas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          peso_de: { type: "number" },
          peso_ate: { type: "number" },
          valor_por_kg: { type: "number" },
          valor_fixo_faixa: { type: "number" },
        },
      },
    },
  },
} as const;

const SYSTEM = `Você extrai dados de tabelas de preço de frete brasileiras.
Regras:
- Números em formato brasileiro (1.234,56) devem virar número decimal (1234.56).
- Percentuais devem ser o número puro (ex: 0,30% -> 0.3).
- faixas: cada linha de faixa de peso. peso_de/peso_ate em kg; use valor_fixo_faixa quando a faixa tem valor fechado e valor_por_kg quando é por quilo (valor "excedente" por kg entra em valor_por_kg da última faixa aberta, com peso_ate ausente).
- tipo_calculo = "peso" quando a cobrança principal é por faixa/kg; "valor" quando é percentual sobre o valor da mercadoria.
- Datas no formato YYYY-MM-DD. Omita campos que não existirem no documento. Não invente valores.`;

export const extractTabelaFrete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractInput) => input)
  .handler(async ({ data }): Promise<ExtractedTabela> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("IA não configurada");
    if (!data.text && !data.dataUrl) throw new Error("Arquivo sem conteúdo legível");

    const content: unknown[] = [
      {
        type: "text",
        text: `Extraia os dados da tabela de frete do arquivo ${data.fileName ?? ""}.${
          data.text ? `\n\nConteúdo:\n${data.text.slice(0, 60000)}` : ""
        }`,
      },
    ];
    if (data.dataUrl) {
      content.push({ type: "image_url", image_url: { url: data.dataUrl } });
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "preencher_tabela_frete",
              description: "Retorna os campos da tabela de frete extraídos do documento",
              parameters: SCHEMA,
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "preencher_tabela_frete" },
        },
      }),
    });

    if (res.status === 429) throw new Error("Limite de uso da IA atingido, tente novamente");
    if (res.status === 402) throw new Error("Créditos de IA esgotados");
    if (!res.ok) throw new Error(`Falha na leitura do arquivo (${res.status})`);

    const json = (await res.json()) as {
      choices?: {
        message?: {
          tool_calls?: { function?: { arguments?: string } }[];
          content?: string;
        };
      }[];
    };
    const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Não foi possível ler os dados da tabela no arquivo");
    return JSON.parse(args) as ExtractedTabela;
  });
