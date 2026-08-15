# Guardar o XML da SEFAZ no banco (varredura + tabela com XML completo)

## Objetivo

O robô faz a varredura na SEFAZ (NF-e por NSU e CT-e por NSU) e tudo que chega é gravado **no banco**: os dados relevantes em colunas e o **XML completo em um campo de texto** na mesma tabela. Depois disso, qualquer releitura do XML (volumes, peso, itens, visualizador de XML, download) usa o banco — nunca mais a SEFAZ.

## O que muda

1. **Tabela de NF-e (`nfes`)**
   - Novo campo com o **XML completo** (texto, sem limite prático).
   - Novos campos de conferência já extraídos do XML: volumes, peso líquido e espécie dos volumes (peso bruto e itens já existem).
   - Campos de rastreio da captura: NSU de origem e data em que o XML foi obtido.

2. **Tabela de CT-e (`ctes`)**
   - Mesmo campo de XML completo, para o visualizador e o download deixarem de depender do arquivo no storage.

3. **Varredura no robô**
   - A varredura de NF-e por NSU passa a rodar a cada ciclo e a enviar ao app todo XML completo encontrado, com o NSU.
   - O contador de NSU da NF-e é independente do CT-e, com opção de reimportação total (recomeça do zero) pelo botão de importação forçada.
   - O log passa a mostrar cada etapa da varredura de NF-e (NSU inicial, cStat, documentos encontrados, notas enviadas), para ficar claro quando nada é retornado.

4. **Recebimento no app**
   - O endpoint de recebimento grava o XML no campo de texto e preenche as colunas a partir dele; se a nota já existir, atualiza (upsert pela chave).
   - Continua enviando o arquivo para o storage por compatibilidade, mas a leitura passa a ser sempre do banco.

5. **Releitura sem SEFAZ**
   - Volumes/peso no detalhamento do CT-e, o visualizador de XML e o download passam a ler o campo do banco.
   - Só cai para a SEFAZ quando a nota ainda não existe no banco.

6. **Backfill**
   - Uma rotina única copia para o novo campo os XMLs de NF-e e CT-e já existentes no storage, para as telas não dependerem mais do bucket.

## Observação importante

A SEFAZ não devolve ao **emitente** os XMLs das notas que ele mesmo emitiu na consulta por chave (é o erro `cStat=641` que apareceu). A varredura por NSU é a via correta, mas se para esta empresa a distribuição também não retornar essas notas (é possível), o campo de XML no banco continua sendo alimentado por **upload manual** e, se você quiser, numa etapa seguinte, pela leitura do XML direto do ERP. A estrutura desta entrega já suporta as três origens.

## Detalhes técnicos

- **Banco central (`speedflow`)**: `ALTER TABLE nfes ADD COLUMN xml_conteudo text, volumes numeric, peso_liquido numeric, especie_volumes text, nsu bigint, xml_obtido_em timestamptz`; `ALTER TABLE ctes ADD COLUMN xml_conteudo text`. Espelhado no schema local só para manter a tipagem gerada.
- **`robo-cte/index.js`**: `processarNfesPorNsu` executado no ciclo principal, na espera curta (a cada 60s) e no comando de importação forçada; NSU próprio em `.ultimo-nsu-nfe`; envio `{ xml, nsu }` para `ingest-nfe`.
- **`robo-cte/sefaz.js`**: `SefazNfeDistClient` (`distNSU`/`ultNSU`) e `filtrarProcNfe` retornando `{ nsu, xml }`, com `gunzip` dos `docZip` e tratamento de `cStat` 137/656 como "sem documentos".
- **`src/routes/api/public/hooks/ingest-nfe.ts`**: aceita payload só com `xml` (+`nsu`), extrai a chave do XML e faz upsert com `xml_conteudo`; conclui a solicitação pendente correspondente.
- **`src/lib/nfe-ingest.server.ts` / `nfe-parse.server.ts`**: gravar `xml_conteudo`, `volumes`, `peso_liquido`, `especie_volumes` (bloco `<vol>`).
- **`src/lib/nfe-volumes.server.ts`**, `XmlViewerDialog`/download de CT-e e NF-e: ler `xml_conteudo` do banco antes de tentar o storage.
- **`src/lib/cte-ingest.server.ts`**: gravar `xml_conteudo` do CT-e junto do registro.
- **Backfill**: script único que percorre `nfes`/`ctes` sem `xml_conteudo`, baixa do bucket e preenche a coluna.
