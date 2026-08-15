# Exibir volumes e peso das NF-es do CT-e

## O que está acontecendo hoje

Verifiquei no banco central e na tela:

- A tabela de NF-es está **vazia** (0 registros). Nenhum XML de nota chegou ao aplicativo até agora.
- As duas notas desse CT-e estão na fila de solicitações: uma travada em "PENDENTE" com 5 tentativas (limite máximo, não será mais tentada) e outra com erro `cStat=641 — NF-e indisponível para o emitente`.
- O robô continua ativo (último contato agora há pouco), mas só a busca por chave está trazendo retorno — e essa busca **nunca** funciona para notas emitidas pela própria empresa. A varredura por NSU (que resolveria) existe no código do robô, porém nenhuma nota foi entregue por ela, o que indica que a versão instalada na máquina do usuário ainda é a anterior ou que a varredura não está avançando.
- O XML do próprio CT-e já traz totais de carga (22 unidades, peso real 62,509 kg), hoje não aproveitados nessa tabela.

## Plano

1. **Mostrar o que já temos, em vez de "aguardando XML"**
   - Quando os XMLs das notas ainda não existirem, preencher a seção "Notas fiscais referenciadas" com os totais de carga do próprio CT-e (volumes/quantidade, peso real, valor da carga), marcados como "dados do CT-e".
   - Manter o detalhe por nota assim que os XMLs chegarem.

2. **Destravar a fila de solicitações**
   - Notas cuja falha foi 641 deixam de ocupar a fila por chave e passam a ser marcadas como "aguardando varredura por NSU", com mensagem clara na tela.
   - Zerar o contador de tentativas travado em 5 para as notas atuais, para que a fila volte a funcionar.

3. **Diagnóstico da varredura de NF-e**
   - Registrar batimento próprio da varredura de NF-e (origem `nfe-nsu`) com último NSU lido e quantidade de notas encontradas.
   - Exibir esse estado na tela de captura, para saber se o robô instalado já roda a varredura.

4. **Atualização do robô**
   - Instruções curtas para atualizar o robô na máquina do certificado (parar serviço, substituir arquivos, iniciar), pois a varredura de NF-e por NSU só funciona na versão nova.

## Detalhes técnicos

- `src/components/ctes/CteDetailView.tsx`: bloco de fallback com `infCarga` do CT-e; leitura do XML já armazenado em `ctes.xml_conteudo`.
- `src/lib/cte-parse.server.ts` / `cte.functions.ts`: expor `infCarga` (qCarga por tpMed, vCarga) no retorno usado pela tela.
- `src/lib/nfe-volumes.server.ts` e `src/routes/api/public/hooks/nfe-pendentes.ts`: excluir da fila por chave as notas cujo emitente é a própria empresa (erro 641) e usar status próprio "AGUARDANDO_VARREDURA".
- `robo-cte/index.js`: heartbeat `nfe-nsu` com último NSU e contagem; sem mudança na lógica de SOAP.
- Ajuste pontual de dados: reset de `tentativas` das solicitações atuais.
