# "Aprovar e lançar no ERP" do CT-e sem n8n

Hoje, ao aprovar um CT-e, o app só grava as filas e espera o n8n gravar os valores no ERP e responder. Com esta mudança, o próprio app faz tudo na hora do clique, como já acontece com a tarefa do Bitrix na autorização de pagamento do fretista.

## O que muda para o usuário

- Ao clicar em **Aprovar e lançar no ERP**:
  1. o app grava os valores de frete (frete, perna, diária, pernoite, reentrega, descarrego) de cada NF-e direto no ERP;
  2. em seguida cria a **tarefa do financeiro no Bitrix**, em nome do usuário que aprovou (exige vínculo com o Bitrix, igual à rota);
  3. mostra o resultado na hora: "Lançado no ERP" + link da tarefa, ou o erro de cada NF-e.
- O CT-e passa a **Lançado no ERP** quando todas as NF-es e a tarefa concluírem; com falha fica **Erro ERP**, e o item entra na fila de pendências com reenvio automático e botão "Reenviar" (agora refazendo a gravação pelo próprio app).
- Antes de aprovar, o botão fica bloqueado com aviso se o usuário não estiver vinculado ao Bitrix.

## Mesmo caminho para a rota do fretista

A tarefa do Bitrix da rota já é criada pelo app, mas a gravação do valor de frete da rota no ERP ainda passa pelo n8n. Ela passa a usar a mesma gravação direta, deixando os dois fluxos 100% sem n8n.

## Detalhes técnicos

- Novo `src/lib/erp-lancamento.server.ts` com `gravarLinhaValores(filaId)`: lê a linha de `fila_lancamento_erp_frete`, chama `POST {ERP_API_BASE_URL}/v1/execute/update_vlr_gerentregas` (`X-API-Key`) com binds numéricos `cod_filial`, `nro_nf`, `bordero` e os 6 valores; confere o retorno (linhas afetadas / consulta em `gks.a_gerentregas`) e marca CONCLUIDO/ERRO, `tentativas`, `proxima_tentativa_em`, `registrarTentativa`.
- `frete-aprovacao.server.ts` (`aprovar`): após inserir as filas, processa cada linha de valores com o helper; monta `titulo_tarefa`/`texto_tarefa`/`data_pagamento`/`autorizado_por` no payload financeiro do CT-e e chama `processarTarefaFinanceiraRota` (generalizada para CT-e); consolida status da ordem e do CT-e (lógica hoje no callback, extraída para função compartilhada).
- `rota-pagamento.server.ts`: após inserir as linhas de valores, chamar o mesmo helper.
- `fila-retry.server.ts` (`tentarItem`): valores e financeiro (CT-e e rota) passam a ser reprocessados pelo app em vez de reenfileirar para o n8n.
- Para evitar gravação dupla, desligar o disparo do n8n: `integracao_n8n.ativo = false` no banco central (o gatilho só chama o webhook quando ativo). O callback `/api/public/hooks/erp-fila-callback` permanece, sem uso.
- `CteAprovacaoPanel.tsx`: checagem de vínculo Bitrix, exibição do resultado por NF-e e link da tarefa.
- Textos de "fluxo n8n" nas telas de configuração/filas ajustados para refletir o envio direto.
