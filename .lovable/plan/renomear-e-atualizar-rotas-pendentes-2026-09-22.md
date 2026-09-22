# Renomear e atualizar Rotas Pendentes

## Objetivo

Deixar claro que a tela apresenta rotas pendentes e permitir que usuários autorizados atualizem esses dados manualmente, acompanhando quando ocorreu a última sincronização concluída com o ERP.

## Alterações

- Renomear “Rotas” para **“Rotas Pendentes”** no menu lateral e no título da tela, mantendo o endereço `/rotas` e os nomes de áreas históricas ou pessoais que têm outro propósito.
- Adicionar ao cabeçalho da tela um botão **“Atualizar rotas”**, ao lado de “Nova rota”.
- Reutilizar a sincronização manual já existente, que consulta o ERP e recria as rotas pendentes preservando os dados manuais previstos pela regra atual.
- Durante a atualização, desabilitar o botão e exibir o estado de carregamento para impedir disparos duplicados.
- Ao concluir, recarregar a lista, totais e dados auxiliares da tela; exibir uma confirmação em português. Em falha, manter os dados atuais visíveis e mostrar uma mensagem em português.
- Exibir abaixo do botão o tempo desde a última sincronização concluída, por exemplo **“Atualizado há 12 minutos”**; quando não houver registro, mostrar **“Ainda não atualizado”**.
- Atualizar esse tempo periodicamente enquanto a tela permanecer aberta e atualizá-lo imediatamente após uma sincronização.
- Respeitar a permissão atual da sincronização: o botão aparece somente para administradores e gestores.
- Adicionar à página os metadados próprios com o nome **“Rotas Pendentes”**.

## Detalhes técnicos

- Consultar o histórico existente em `erp_sync_runs`, usando `finished_at` da execução mais recente concluída com sucesso.
- Reutilizar `triggerErpSync` e o tratamento já existente para quedas de conexão/execuções que continuam no servidor, evitando duplicar a lógica de sincronização.
- Invalidar as consultas de rotas, responsáveis e último horário após sucesso.
- Validar em tela larga e celular, incluindo carregamento, sucesso, falha e ausência de histórico.

## Arquivos principais

- `src/components/layout/AppShell.tsx` — nome no menu.
- `src/routes/_authenticated/rotas.index.tsx` — título, botão, horário e metadados.
- Componente compartilhado de sincronização, se necessário, para reutilizar o fluxo existente sem duplicação.
