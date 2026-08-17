# Corrigir a captura dos dados das NF-es pela SEFAZ

## O que foi verificado agora

- As duas notas do CT-e aberto **não existem** na tabela `nfes` do banco central (a tabela inteira tem apenas 2 registros).
- A fila de solicitações tem **30 registros com status ERRO** e 2 concluídas. A nota da imagem falhou com:
  `SEFAZ retornou cStat=641: Rejeicao: NF-e indisponivel para o emitente`.
- O robô está online (heartbeat de hoje, 15:17), mas a varredura por NSU reporta sempre
  `NSU 0 | 0 nota(s) enviada(s)` — ou seja, ela nunca avança de NSU nem traz documentos.

Conclusão: a consulta por chave (`consChNFe`) nunca vai funcionar para notas emitidas pela própria
empresa do certificado (é exatamente o que o 641 diz). O caminho válido com o certificado A1 é a
**distribuição por NSU (`distNSU`) no NFeDistribuicaoDFe**, e é essa varredura que está falhando/parada.

## O que será feito

### 1. Diagnóstico da varredura por NSU (primeiro passo, antes de mudar regra)

Hoje não dá para saber se a SEFAZ responde `cStat=137` (nenhum documento), erro de certificado, ou se
o robô instalado no servidor está numa versão antiga. Serão adicionados:

- Log detalhado por ciclo já existente (`cStat`, `ultNSU`, `maxNSU`, `documentos`) enviado também ao
  heartbeat, para aparecer no app: hoje o heartbeat só mostra o NSU salvo.
- Novo detalhe no heartbeat `nfe-nsu`: `cStat`, `xMotivo`, `maxNSU` e quantidade de resumos (`resNFe`)
  descartados.
- Comando de diagnóstico no robô (`node index.js --diagnostico-nfe`) que faz uma consulta NSU 0 e
  imprime o retorno bruto resumido, para colar aqui caso a SEFAZ recuse o certificado.

### 2. Correções na varredura por NSU (robô)

- Persistir o NSU mesmo quando o ciclo termina por erro, e nunca zerar o arquivo `.ultimo-nsu-nfe`
  em execução normal.
- Tratar `cStat=137` como "sem novidades" mantendo `maxNSU` (hoje ele volta `maxNsu = ultimoNsu`, o
  que trava a varredura em 0 para sempre).
- Aproveitar os documentos `resNFe` (resumo): guardar chave/número/valor e marcar a solicitação
  como "resumo recebido", em vez de descartar silenciosamente.
- Rodar a varredura de NF-e também quando o usuário aciona **Forçar importação**, com opção de
  reiniciar do NSU 0.

### 3. Fila de solicitações no app

- Solicitações com erro **641** deixam de ser tentadas por chave: passam para o estado
  `AGUARDANDO_VARREDURA`, para não ficarem consumindo tentativas nem poluindo a tela.
- Botão "Tentar novamente" na tela da NF-e passa a disparar a varredura por NSU (não a consulta por
  chave) quando a nota é da própria empresa.

### 4. Exibição no CT-e (fallback pedido)

Enquanto o XML da NF-e não chega, a tabela "Notas fiscais referenciadas" passa a mostrar volumes e
peso a partir do bloco `infCarga`/`infNFe` do próprio CT-e, com marcação de que o valor veio do CT-e
(e não da NF-e), em vez de traços ou "aguardando varredura".

### 5. Pacote de atualização do robô

Novo zip para download com as mudanças acima e instruções curtas de atualização no servidor.

## Detalhes técnicos

- `robo-cte/sefaz.js`: `SefazNfeDistClient.consultar` retorna `maxNsu` real em 137; expõe
  `resumos` separados de `xmls`.
- `robo-cte/index.js`: `processarNfesPorNsu` com persistência de NSU em `finally`, heartbeat
  detalhado e flag `--diagnostico-nfe`.
- `src/lib/nfe-volumes.server.ts`: novo status `AGUARDANDO_VARREDURA` e fallback com dados do CT-e.
- `src/routes/api/public/hooks/nfe-pendentes.ts`: excluir da fila por chave as notas cujo emitente
  é o CNPJ do certificado (erro 641).
- `src/components/ctes/CteDetailView.tsx`: coluna de origem do dado (NF-e ou CT-e).
- Migração no banco central: reclassificar as 30 solicitações em ERRO 641 para o novo status.
