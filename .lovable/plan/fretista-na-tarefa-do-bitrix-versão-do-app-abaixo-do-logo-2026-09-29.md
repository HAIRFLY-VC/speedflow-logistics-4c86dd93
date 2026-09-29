# Fretista na tarefa do Bitrix + versão do app abaixo do logo

## 1. Tarefa da rota 424 sem os dados do fretista

**O que a tarefa mostra:** "Fretista: — (código ERP: —)", "Favorecido: —" e "PIX NÃO CADASTRADO". Isso quer dizer que, quando a tarefa foi montada, o app não encontrou nenhum código de fretista para a rota.

**Causa provável (ainda a confirmar):** o texto da tarefa usa os dados da rota carregados *antes* da busca pelo fretista. A busca no ERP pode preencher o código depois, mas o nome não é aproveitado. Se a rota ainda não tinha código salvo, ou se o ERP demorou ou falhou naquele momento (o mesmo problema das rotas 425/426), o app seguia com tudo vazio. Ele ainda confirmava o pagamento e criava a tarefa sem fretista.

**O que será feito:**
- Primeiro passo: consultar a rota 424 e a ordem de pagamento dela no banco (código e nome do fretista, horário da confirmação) para confirmar a causa.
- O texto da tarefa passa a usar sempre o fretista encontrado na busca (código e nome vindos do cadastro de fretistas/transportadoras), e não os dados antigos da rota.
- O servidor recusa "Confirmar e enviar" quando não consegue identificar o fretista. A mensagem fica clara ("Fretista da rota não identificado — use Consultar PIX no ERP"), para não criar uma tarefa incompleta.
- A chave PIX continua saindo apenas no texto da tarefa do Bitrix, nunca nas telas.
- Rota 424: depois da correção, os dados do fretista serão acrescentados à tarefa já existente no Bitrix, com um comentário que traz as instruções de pagamento corretas. Não será criada uma tarefa duplicada.

## 2. Versão abaixo do logo

- Abaixo de "SpeedFlow Logistics", no menu lateral e no topo, aparece uma linha pequena, por exemplo "v1.0.0 · 29/09/2026 07:40".
- Um selo diferencia os ambientes:
  - **TESTE** (âmbar): na pré-visualização do editor.
  - **OFICIAL** (verde): no site publicado (speedflow-logistics.lovable.app).
- A versão e a data/hora são geradas automaticamente a cada atualização, sem nenhuma ação manual.

## Detalhes técnicos
- `rota-pagamento.server.ts`: `montarTextoTarefa` recebe o código e o nome resolvidos (`situacaoPix` + `erp_responsaveis.razao_social`). `confirmarPagamentoRota` lança erro se `codResponsavelDaRota` retornar null.
- Ação única para a rota 424: `tasks.task.update` / comentário via webhook Bitrix com o texto recalculado.
- `vite.config.ts`: `define` com `__APP_VERSION__` (package.json) e `__BUILD_TIME__`. O ambiente é identificado pelo hostname (`id-preview--`/`localhost` = TESTE, os demais = OFICIAL). O selo fica abaixo do logo em `AppShell.tsx`, usando cores do design.
