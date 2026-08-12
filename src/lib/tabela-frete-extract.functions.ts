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
  rotas?: {
    origem?: string | null;
    destino?: string | null;
    uf_origem?: string | null;
    uf_destino?: string | null;
    tarifa_frete_peso?: number | null;
    frete_valor_percentual?: number | null;
    taxa_despacho?: number | null;
    frete_minimo?: number | null;
    peso_minimo_kg?: number | null;
    prazo_entrega_min_dias?: number | null;
    prazo_entrega_max_dias?: number | null;
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
    rotas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          origem: { type: "string" },
          destino: { type: "string" },
          uf_origem: { type: "string" },
          uf_destino: { type: "string" },
          tarifa_frete_peso: { type: "number" },
          frete_valor_percentual: { type: "number" },
          taxa_despacho: { type: "number" },
          frete_minimo: { type: "number" },
          peso_minimo_kg: { type: "number" },
          prazo_entrega_min_dias: { type: "number" },
          prazo_entrega_max_dias: { type: "number" },
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
- rotas: MUITO IMPORTANTE. Quando a tabela tiver preços por ORIGEM e DESTINO (linhas com colunas como ORIGEM, DESTINO, TARIFA FRETE PESO (kg), FRETE VALOR, TAXA DESPACHO, FRETE PESO MÍNIMO, PRAZO DE ENTREGA), crie um item em "rotas" para CADA linha da tabela, repetindo a origem quando ela estiver mesclada em várias linhas e repetindo taxa de despacho quando mesclada.
  - tarifa_frete_peso = valor por kg da linha; frete_valor_percentual = percentual sobre o valor da mercadoria; taxa_despacho = valor fixo; frete_minimo = valor do frete peso mínimo; peso_minimo_kg = peso indicado no cabeçalho do frete mínimo (ex: "FRETE PESO MÍNIMO (50kg)" -> 50).
  - prazo "2 A 3" -> prazo_entrega_min_dias 2 e prazo_entrega_max_dias 3; prazo único "3" -> ambos 3.
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
