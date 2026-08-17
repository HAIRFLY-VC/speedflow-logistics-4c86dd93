# Leitura da NF-e sob demanda pelo robô

## O que o teste de agora mostrou

- Robô online (último contato 15:55) e respondendo à fila de comandos.
- Heartbeat da varredura: `NSU 0 | 0 nota(s) enviada(s)`, **sem** o bloco de diagnóstico
  (`cStat=... | maxNSU=... | docs=...`) que a versão nova envia — ou o serviço no servidor
  ainda roda o código antigo, ou a consulta falha antes de chegar ao diagnóstico.
- Banco central: 1 NF-e completa gravada (de terceiro). As notas da própria empresa
  (emitente 10627976000142) seguem com `cStat=641`, e outra nota com `cStat=632`
  (fora do prazo de download na SEFAZ).

Conclusão: a SEFAZ não devolve ao emitente o XML das próprias notas, e notas antigas de
terceiros caem no prazo (632). A captura precisa de uma fonte local no servidor.

## Como vai funcionar

O app continua sendo quem pede: ao abrir uma NF-e sem XML (ou ao clicar em "Tentar
novamente"), entra uma solicitação na fila. O robô passa a atender essa solicitação em
três etapas, na ordem:

1. **Arquivo local do ERP** — procura o XML pela chave nas pastas configuradas no servidor.
2. **SEFAZ por chave** — só se não achou localmente (funciona para notas de terceiros
   dentro do prazo).
3. **Erro explicativo** — devolve ao app o motivo real ("não encontrado na pasta X e
   SEFAZ respondeu 641/632"), que aparece na tela da NF-e.

## Mudanças

### Robô (`robo-cte/`)

- Nova configuração `pastasXmlNfe: ["C:/ERP/xml/nfe", ...]` (busca recursiva, cache de
  índice por chave, atualizado a cada ciclo).
- `processarNfesPendentes` passa a tentar a pasta local antes da SEFAZ e envia o XML
  encontrado ao mesmo hook `ingest-nfe`.
- Novo comando `node index.js --testar-nfe <chave>` que mostra onde a nota foi encontrada
  (pasta ou SEFAZ) sem enviar nada.
- Log e heartbeat da varredura NSU passam a registrar também a origem usada por nota.
- `config.exemplo.json` e `README.md` atualizados com a nova chave de configuração.

### App

- Mensagem de erro da solicitação exibida na tela da NF-e passa a distinguir
  "não encontrado no servidor" de "recusado pela SEFAZ".
- Botão "Tentar novamente" reenvia a solicitação para o robô (fila por chave), inclusive
  para notas com 641 — agora faz sentido, porque o robô procura no disco.
- Sem mudança de schema: a fila `nfe_solicitacoes` e a tabela `nfes` já atendem.

### Pacote de download

Novo zip com tudo dentro de uma única pasta `robo-cte/`, contendo os arquivos alterados e
instruções curtas de atualização e de preenchimento de `pastasXmlNfe`.

## O que preciso de você

1. Rodar `node index.js --diagnostico-nfe` na pasta do robô e colar a saída (confirma a
   versão e o retorno da SEFAZ).
2. Informar o caminho da pasta no servidor onde o ERP grava os XMLs das NF-es.
