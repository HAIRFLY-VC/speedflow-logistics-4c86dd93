- [x] Remover os cartões de resumo apenas da tela Autorizar pagamento de frete.
- [x] Exibir as rotas em tabela sem agrupamento, inclusive em telas estreitas.
- [x] Permitir filtros por coluna e restaurá-los automaticamente para cada usuário.
- [x] Somar ao frete exibido os valores adicionais autorizados da rota, sem contar pagamentos substituídos.
- [x] Sugerir o vencimento oito dias após a data planejada de expedição da rota, mantendo a data editável.- [x] Exigir PIX do fretista para Confirmar Pgto (botão desabilitado com aviso) e incluir instrução de PIX na tarefa do Bitrix.
- [x] Registrar o PIX usado em cada autorização e bloquear troca de PIX até liberação de administrador.

## Configuração dos participantes da tarefa do Bitrix
- [x] Webhook novo (vudzzdzvccplzbep) com Tarefas + Usuários
- [x] Script 2026-09-25_bitrix_config.sql (bitrix_task_config + profiles.bitrix_user_id) — usuário precisa rodar no banco
- [x] Seção "Tarefas do Bitrix" em Configurações (responsável, observadores, vínculo app↔Bitrix)
- [x] Criador da tarefa = usuário Bitrix vinculado a quem autorizou; sem vínculo, Confirmar Pgto bloqueado
