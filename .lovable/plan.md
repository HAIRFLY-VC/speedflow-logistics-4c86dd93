# Pendência de tarefa do Bitrix nas rotas (v1.15.0 — MINOR)

Quando a tarefa do Bitrix não for criada de primeira (como na rota 423), a rota passa a mostrar que tem uma pendência, e o app tenta de novo sozinho.

## O que muda para o usuário

- **Novo status de pagamento "Confirmado c/ pendência"**: aparece na coluna e no filtro "Status pgto" de "Autorizar pagamento de frete", ao lado de "Confirmado" e "Pendente". Quando a tarefa for criada, volta a ser "Confirmado".
- **Ícone de alerta (âmbar, pulsando)** ao lado do código da rota sempre que houver pendência.
- **Texto ao passar o mouse** explicando a pendência, por exemplo:
  "Tarefa do Bitrix não criada. Tentativa 3 de 10. Último erro: <mensagem>. Próxima tentativa em 1 min."
  Depois de 10 falhas: "O app parou de tentar após 10 tentativas. Use Reenviar em Envios desta rota ou a tela Pendências de integração."
- **Novas tentativas automáticas**: uma por minuto, até 10. Depois disso, fica parada até alguém mandar reenviar à mão (o botão manual reinicia a contagem).

## Riscos para a versão publicada

- O banco é o mesmo: a regra de 10 tentativas por minuto vale também para a publicada assim que o código novo for publicado. Hoje a publicada usa intervalos de 1, 5, 15 e 30 min, sem limite.
- Nenhuma mudança de estrutura no banco: uso as colunas que já existem (`tentativas`, `proxima_tentativa_em`, `ultimo_erro`).
- O robô que agenda as novas tentativas precisa rodar a cada minuto. Vou conferir o agendamento atual e, se estiver mais espaçado, mostro o SQL para ajustar antes de aplicar.

## Detalhes técnicos

- `fila-retry.server.ts`: para a fila `financeiro`, intervalo fixo de 1 min e limite de 10 tentativas (`MAX_TENTATIVAS_BITRIX = 10`). Ao chegar em 10, grava `proxima_tentativa_em = null` e não entra mais na varredura (`processarPendencias` filtra `tentativas < 10` na fila financeira). A fila `valores` mantém a regra atual.
- `tentarAgora` (manual) zera `tentativas` antes de tentar, reiniciando o ciclo.
- Confirmação do pagamento (`rota-pagamento.server.ts`): se a criação imediata falhar, já deixa `proxima_tentativa_em = agora + 1 min`.
- Novo dado por rota na listagem: resumo da pendência financeira (status, tentativas, último erro, próxima tentativa), buscado em lote em `fila_provisionamento_financeiro` pelos `route_id` da página (linhas com status diferente de CONCLUIDO e sem resolução manual).
- `RotasView.tsx`: `filterAccessor` de "Status pgto" passa a devolver "Confirmado c/ pendência"; ícone `AlertTriangle` com `Tooltip` junto ao código da rota.
- Agendamento: conferir o cron que chama `/api/public/hooks/fila-retry`; se não for a cada minuto, propor `cron.alter_job` para `* * * * *`.
- Versão 1.15.0 e entrada no CHANGELOG.
