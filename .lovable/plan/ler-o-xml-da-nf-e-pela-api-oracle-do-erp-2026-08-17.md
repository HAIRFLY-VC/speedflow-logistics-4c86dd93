# Ler o XML da NF-e pela API Oracle do ERP

## Situação atual (verificada)

- A SEFAZ não devolve ao emitente o XML das próprias notas (`cStat=641`) e recusa notas antigas
  por prazo (`cStat=632`). O robô está online, mas a varredura por NSU segue em
  `NSU 0 | 0 nota(s) enviada(s)`.
- No banco central há apenas 1 NF-e completa (de terceiro); as notas do CT-e continuam sem XML.
- O app já fala com o ERP: `POST {ERP_API_BASE_URL}/v1/query` com `{ sql, binds, limit }` e header
  `X-API-Key` (usado hoje em `src/lib/erp-sync.server.ts`).

Com a consulta Oracle informada, o próprio app passa a buscar o XML — sem depender do robô nem da
SEFAZ para as notas da empresa.

## Como vai funcionar

1. O app precisa do XML de uma chave (tela da NF-e, ou ingestão de um CT-e que referencia notas).
2. Busca primeiro no banco central (`nfes.xml_conteudo`) — se já existe, não consulta nada.
3. Se não existe, consulta a API Oracle do ERP:

```sql
select x.gcf_nfe_xml_nfe
  from gks.gcf_nfe n, gks.gcf_nfe_xml x
 where n.gcf_nfe_chave = :chave
   and x.gcf_nfe_xml_id = n.gcf_nfe_id
```

4. Retornando XML, ele é parseado e gravado normalmente (colunas de conferência + `xml_conteudo`),
   exatamente como acontece hoje na ingestão vinda do robô.
5. Se o ERP não tiver a nota, aí sim entra a fila do robô/SEFAZ como hoje (útil para notas de
   terceiros), com mensagem de erro clara distinguindo "não encontrada no ERP" de "recusada pela SEFAZ".

## Mudanças

### Backend

- `src/lib/nfe-erp.server.ts` (novo): `buscarXmlNfeNoErp(chave)` — chama a API do ERP com a query
  acima via bind, trata retorno CLOB (string ou objeto/base64), valida que o conteúdo é um XML de
  NF-e e devolve `null` quando não encontrado.
- `src/lib/nfe.functions.ts`: `solicitarNfeXml` passa a tentar o ERP antes de enfileirar para o robô;
  quando encontra, grava via `ingestNfeXml` e retorna a nota já pronta.
- `src/lib/nfe-volumes.server.ts` / ingestão do CT-e: ao detectar notas sem XML, tenta o ERP em lote
  (limite por execução) antes de criar solicitação para o robô.
- Registro da origem do XML (`ERP` ou `SEFAZ`) na tabela `nfes` para rastreio.

### UI

- Tela da NF-e: botão "Tentar novamente" busca no ERP primeiro e mostra o resultado imediatamente;
  mensagens de status diferenciando ERP e SEFAZ.
- Tabela "Notas fiscais referenciadas" do CT-e: assim que o XML vem do ERP, volumes e peso passam a
  sair da própria NF-e (deixa de aparecer o fallback "(CT-e)").

### Banco central

- Migração pequena: coluna `xml_origem` em `nfes` (texto, opcional).

## Detalhes técnicos

- Reaproveita o cliente HTTP do ERP já existente (mesma URL, mesmo `X-API-Key`, timeout curto e
  `limit: 1`), sem nova credencial.
- Chave passada por bind, nunca concatenada na SQL.
- Nenhuma alteração no robô nesta etapa; ele continua cobrindo CT-e e notas de terceiros.
