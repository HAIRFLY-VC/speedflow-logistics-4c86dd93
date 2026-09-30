# Excluir o botão "Atualizar rotas" da tela Rotas Pendentes

**Classificação:** PATCH — versão proposta **1.13.1**.

## O que muda

- Remover da tela **Rotas Pendentes** o botão **"Atualizar rotas"** e o texto **"Atualizado há X minutos / Ainda não atualizado"** exibido abaixo dele.
- O botão **"Nova rota"** continua no mesmo lugar.
- O botão de sincronização que fica no cabeçalho geral do app (menu lateral) permanece inalterado.

## Alterações

- `src/components/routes/RotasView.tsx`: remover a linha `<ErpSyncButton label="Atualizar rotas" lastSyncPrefix="Atualizado" />` e a importação do componente.
- A prop `mostrarAcoesDeRota` é mantida (ela também controla a tabela compacta e o card de pedidos sem rota); apenas o botão deixa de ser renderizado.
- Nenhuma lógica de sincronização é apagada — o ERP continua sincronizando normalmente pelo fluxo atual.

## Impacto e segurança

- Nenhuma alteração no banco de dados, permissões, integrações ou regras de negócio.
- Nenhuma nova flag; a mudança vale igualmente em teste e produção ao publicar.

## Checklist para publicar

- Conferir no preview que "Atualizar rotas" e o texto de atualização não aparecem mais na tela, e que "Nova rota" e o restante da tela funcionam.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: restaurar a versão **1.13.0** pelo histórico do Lovable.
