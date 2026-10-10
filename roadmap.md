- [x] Remover os cartões de resumo apenas da tela Autorizar pagamento de frete.
- [x] Exibir as rotas em tabela sem agrupamento, inclusive em telas estreitas.
- [x] Permitir filtros por coluna e restaurá-los automaticamente para cada usuário.
- [x] Somar ao frete exibido os valores adicionais autorizados da rota, sem contar pagamentos substituídos.
- [x] Sugerir o vencimento oito dias após a data planejada de expedição da rota, mantendo a data editável.- [x] Exigir PIX do fretista para Confirmar Pgto (botão desabilitado com aviso) e incluir instrução de PIX na tarefa do Bitrix.
- [x] Registrar o PIX usado em cada autorização e bloquear troca de PIX até liberação de administrador.

## Configuração dos participantes da tarefa do Bitrix
- [x] Webhook novo (vudzzdzvccplzbep) com Tarefas + Usuários
- [x] Script 2026-09-25_bitrix_config.sql (bitrix_task_config + profiles.bitrix_user_id) — rodado e validado no banco (gravação OK)
- [x] Seção "Tarefas do Bitrix" em Configurações (responsável, observadores, vínculo app↔Bitrix)
- [x] Criador da tarefa = usuário Bitrix vinculado a quem autorizou; sem vínculo, Confirmar Pgto bloqueado

## Oficial igual ao teste
- [x] Todas as funcionalidades do teste ligadas na oficial (v1.6.0); novas nascem ligadas nos dois

## Pedidos sem rota — detalhes operacionais
- [x] Agrupar clientes sem repetição e ordenar geograficamente por UF, cidade, bairro e cliente.
- [x] Exibir detalhes dos pedidos e observações do ERP sem rolagem lateral.
- [x] Validar seleção, filtros e apresentação em computador e celular.
- [x] Calcular quilometragem com coordenadas do pedido ou do cliente e identificar endereços não localizados.

## Impressão de rotas
- [x] Organizar cada entrega em uma linha totalizadora seguida do detalhamento dos pedidos e usar Retrato como orientação inicial.
- [x] Sugerir o nome do arquivo RT_<código da rota>_<data yyyymmdd>.pdf ao salvar a impressão em PDF e manter o contador "Página X de Y" no canto inferior direito do PDF.
- [x] Exibir a marcação de página também no canto inferior direito da folha mostrada no app.

## Auditoria de frete mínimo
- [x] Aplicar o mínimo somente ao FRETE PESO, manter FRETE VALOR separado e sinalizar a substituição do calculado.
