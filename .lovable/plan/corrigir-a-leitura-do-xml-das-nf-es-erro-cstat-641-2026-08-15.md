# Corrigir a leitura do XML das NF-es (erro cStat=641)

## O que está acontecendo

O robô pede o XML da NF-e à SEFAZ pela **consulta por chave** (`consChNFe`). Nesse serviço a Receita só entrega o XML completo para o **destinatário** da nota. Como as notas em questão foram emitidas pela própria empresa do certificado A1, a SEFAZ responde `cStat=641 — NF-e indisponível para o emitente`, e o app mostra a tela de erro anexada.

A forma correta de o emitente obter os próprios XMLs é a **varredura por NSU** no mesmo serviço de distribuição — exatamente o mecanismo que o robô já usa para os CT-es, porém no fluxo de NF-e, que tem contador de NSU próprio.

## O que será feito

1. **Varredura de NF-e por NSU no robô**
   - Novo cliente de distribuição de NF-e por NSU (`distNSU`), separado do já existente por chave.
   - Contador de NSU próprio por empresa (arquivo de estado independente do NSU dos CT-es), com opção de reimportação total a partir do zero.
   - A cada ciclo o robô lê os documentos disponíveis, filtra os XMLs completos de NF-e (`procNFe`/`nfeProc`) e envia ao aplicativo. Resumos (`resNFe`) são ignorados, pois não trazem volumes.

2. **Aplicativo recebe qualquer NF-e da varredura**
   - O endpoint de recebimento passa a aceitar XMLs que não foram explicitamente solicitados: a chave é lida do próprio XML, a nota é gravada (volumes, peso bruto, peso líquido, espécie, itens) e qualquer solicitação pendente daquela chave é marcada como concluída.
   - Solicitações que hoje estão com erro 641 voltam a ficar pendentes e são atendidas assim que a nota aparecer na varredura.

3. **Consulta por chave vira apenas complemento**
   - O robô continua tentando a consulta direta por chave (funciona quando a empresa é a destinatária), mas ao receber 641 não marca mais a solicitação como erro definitivo: registra que a nota será obtida pela varredura e mantém a solicitação aguardando.

4. **Mensagens na tela**
   - Na tela da NF-e e no detalhamento do CT-e, no lugar de "Não foi possível ler o XML na SEFAZ" com o texto técnico, aparece "Aguardando a varredura da SEFAZ (a nota foi emitida pela própria empresa)" com o botão de tentar novamente e a opção de importar o XML manualmente.
   - Erros reais de SEFAZ continuam sendo exibidos com a mensagem original.

## Detalhes técnicos

- `robo-cte/sefaz.js`: nova classe `SefazNfeDistClient` usando `NFeDistribuicaoDFe` com `<distNSU><ultNSU>`, reaproveitando o `postXmlAction`, o `gunzip` dos `docZip` e o tratamento de `cStat` (`137`/`656` = sem documentos).
- `robo-cte/index.js`: novo passo `processarNfesPorNsu(cfg, modoTeste)` no ciclo, com paginação de 50 documentos, avanço de NSU controlado e `withTimeout`, gravando o NSU em `nsu-nfe-<indice>.txt`.
- `src/routes/api/public/hooks/ingest-nfe.ts`: aceitar payload só com `xml`; extrair a chave via `parseNfeXml`, gravar em `nfes` (upsert) e atualizar `nfe_solicitacoes` quando existir; ignorar duplicados.
- `src/routes/api/public/hooks/nfe-pendentes.ts`: incluir também solicitações em `ERRO` cuja mensagem seja `cStat=641`, para nova tentativa via varredura.
- `src/lib/nfe.functions.ts` / `src/routes/_authenticated/nfes.$chave.tsx` / `src/components/ctes/CteDetailView.tsx`: tratar `641` como estado "aguardando varredura" em vez de erro.
- Sem alterações de banco: as colunas usadas já existem; volumes e peso continuam sendo lidos do XML armazenado.
