# Calendário comercial continua "não carregado" após Sync ERP (PATCH v1.20.1)

## Causas possíveis (a confirmar no 1º passo)
1. A tabela do calendário ainda não existe no banco central (o script SQL manual não foi confirmado como executado) — o Sync ERP tenta gravar, falha em silêncio e só registra o erro no histórico do sync.
2. A consulta ao ERP do calendário falhou ou não retornou linhas (erro também fica só no histórico).
3. O Dashboard guarda o resultado antigo (vazio) por 5 minutos e não é atualizado quando o Sync ERP termina.

## O que será feito
1. Diagnóstico: verificar no banco central se a tabela existe e tem linhas, e ler os erros da última execução do Sync ERP ("Atualizar calendário comercial: ...").
2. Se a tabela não existir: reentregar o script SQL corrigido para você executar e rodar o Sync de novo.
3. Dashboard: recarregar o calendário automaticamente ao fim do Sync ERP (e ao trocar para "Calendário comercial").
4. Mensagem mais clara no aviso, dizendo o motivo real: "tabela não criada no banco", "Sync não trouxe dados do ERP" ou "erro: ...", em vez do texto genérico.
5. Ao fim do Sync ERP, se a etapa do calendário falhar, mostrar aviso explícito na notificação.

## Detalhes técnicos
- `dashboard.tsx`: distinguir `calendarioQ.error` (ex.: relação inexistente) de lista vazia; `invalidateQueries(["erp","calendario-comercial"])` no sucesso do sync.
- `erp-sync.server.ts`: retornar contagem/erro do calendário no resultado do sync para o toast.
- Atualizar `version.ts` e `CHANGELOG.md`. Sem migração automática (banco central é manual).
