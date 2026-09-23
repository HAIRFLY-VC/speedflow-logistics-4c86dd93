# Fila de pendências de lançamento no ERP

Hoje, quando o ERP responde com erro (como o 502 das notas 65246/65247 do lançamento adicional), o envio fica parado como "Erro" dentro da rota e só volta a andar se alguém abrir aquela rota e clicar em reenviar. A tarefa do Bitrix foi criada normalmente, o que deixa a impressão de que tudo deu certo.

A proposta: transformar essas pendências em uma fila que o app tenta resolver sozinho, avisa os administradores e pode ser gerenciada em uma tela própria.

## 1. Reenvio automático

- Toda linha com erro passa a ter uma hora marcada para a próxima tentativa.
- Intervalos crescentes: 1 min, 5 min, 15 min, 30 min e daí em diante sempre 30 min.
- Uma rotina do app roda a cada 5 minutos e reenvia apenas o que já venceu o intervalo (cerca de 288 verificações por dia; verificações frequentes mantêm o banco ativo e têm um custo recorrente — 5 minutos é o menor intervalo que atende os 1 e 5 min iniciais).
- Cada tentativa grava data/hora, número da tentativa e a mensagem exata devolvida pelo ERP ou pelo Bitrix.
- Quando o envio dá certo, a pendência sai da fila automaticamente e a ordem de pagamento é atualizada.

## 2. Aviso aos administradores

Todos os usuários com perfil de administrador são avisados quando há pendências:

- **No app**: contador no sino de notificações e indicador no menu da nova tela.
- **Por e-mail**: um resumo quando uma pendência passa de 3 tentativas sem sucesso, e no máximo um e-mail por hora para não inundar a caixa.
- **Por WhatsApp**: mesma regra do e-mail.

Dependências que preciso de você:
- E-mail: preciso preparar o envio de e-mails do app (domínio de envio). Faço isso na etapa de construção e te mostro o que confirmar.
- WhatsApp: exige ligar o Twilio (número WhatsApp verificado). Abro a tela de conexão na hora de construir; enquanto não estiver ligado, app e e-mail funcionam normalmente.
- Cada administrador precisa ter e-mail e telefone no cadastro; incluo esses campos na tela de usuários.

## 3. Tela "Pendências de integração"

Nova tela no menu, visível para administradores, com todas as transações pendentes (ERP e Bitrix), de rotas e de CT-e:

- Lista com rota/CT-e, filial, nota fiscal, borderô, valor, tipo de lançamento, situação, número de tentativas, hora da última e da próxima tentativa.
- Mensagem de erro completa, legível, com o trecho útil destacado (ex.: "ERP indisponível — 502").
- Filtros por situação, origem e período, e busca por rota/nota.
- Ações: **Tentar agora** (item a item ou em lote), **Pausar** as tentativas, **Marcar como resolvido manualmente** (com justificativa, para casos já lançados direto no ERP).
- Histórico de cada tentativa do item.

## Detalhes técnicos

- Migração no banco central (`db/central/`): em `fila_lancamento_erp_frete` e `fila_provisionamento_financeiro`, novas colunas `proxima_tentativa_em`, `pausada_em`, `resolvida_manualmente_em/por/motivo`; nova tabela `fila_tentativas` (fila, fila_id, tentativa, ok, mensagem, criado_em); nova tabela `notificacoes_pendencias` para controlar o envio por hora. Grants para `authenticated`/`service_role`.
- Processador em `src/lib/fila-retry.server.ts`: seleciona itens `ERRO`/`PENDENTE` com `proxima_tentativa_em <= now()`, reenvia valores (mesma rota do n8n, via `reenviarItemFila`) e financeiro (`processarTarefaFinanceiraRota`, Bitrix direto), grava tentativa e calcula o próximo intervalo.
- Endpoint `src/routes/api/public/hooks/fila-retry.ts` protegido por `ERP_SYNC_CRON_SECRET`, agendado com `pg_cron` a cada 5 minutos.
- Notificações em `src/lib/notificacoes-pendencias.server.ts`: e-mail via infra de e-mail do projeto e WhatsApp via gateway do Twilio; destinatários = usuários com `has_role(adm)`.
- Nova rota `src/routes/_authenticated/pendencias-integracao.tsx` usando `DataTable`, com server fns em `src/lib/fila-pendencias.functions.ts` (listar, tentar agora, pausar, resolver manualmente) — todas checando perfil administrador.
- O painel existente dentro da rota (`FilasErpPanel`/`PagamentoRotaDialog`) continua funcionando e passa a mostrar "próxima tentativa automática".
