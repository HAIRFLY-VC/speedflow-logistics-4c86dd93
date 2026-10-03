# Calendário comercial continua "não carregado" após Sync ERP (PATCH v1.20.1)

## Causas possíveis (a confirmar no 1º passo)
O script da tabela já foi executado com sucesso, então restam:
1. A consulta ao ERP do calendário falhou, não retornou linhas ou as datas vieram num formato não reconhecido (o erro fica só no histórico do sync, sem aviso na tela).
2. O Dashboard guarda o resultado antigo (vazio) por 5 minutos e não é atualizado quando o Sync ERP termina.
3. Permissão de leitura da tabela para usuários logados ausente.

## O que será feito
1. Diagnóstico: verificar no banco central se a tabela tem linhas e ler os erros da última execução do Sync ERP ("Atualizar calendário comercial: ...").
2. Corrigir a causa encontrada (formato de datas do ERP, permissão de leitura ou consulta).
3. Dashboard: recarregar o calendário automaticamente ao fim do Sync ERP (e ao trocar para "Calendário comercial").
4. Mensagem mais clara no aviso com o motivo real ("Sync não trouxe dados do ERP" ou "erro: ...") em vez do texto genérico.
5. Ao fim do Sync ERP, se a etapa do calendário falhar, mostrar aviso explícito na notificação.

## Detalhes técnicos
- `dashboard.tsx`: distinguir `calendarioQ.error` (ex.: relação inexistente) de lista vazia; `invalidateQueries(["erp","calendario-comercial"])` no sucesso do sync.
- `erp-sync.server.ts`: retornar contagem/erro do calendário no resultado do sync para o toast.
- Atualizar `version.ts` e `CHANGELOG.md`. Sem migração automática (banco central é manual).
