# Por que os valores não foram contabilizados no ERP

## O que eu verifiquei agora

- O ERP **voltou a responder** (teste feito agora: resposta normal). O erro 502 mostrado nos dois itens da rota erp-414 (NF 65246 e 65247) foi uma indisponibilidade momentânea do servidor do ERP naquele horário, não um erro de dados.
- Os dois itens continuam parados **porque a atualização do banco ainda não foi aplicada**. As colunas e tabelas de controle das novas tentativas (`proxima_tentativa_em`, histórico de tentativas, avisos) não existem no banco central — confirmei consultando o banco.

Consequência prática: o app registrou o erro, mas não tem onde marcar "tentar de novo às X horas", então a rotina automática nunca pega esses itens. Por isso a tela mostra "Próxima tentativa automática: —" e nada acontece sozinho.

## O que vamos fazer

1. **Aplicar a atualização do banco** (arquivo `db/central/2026-09-23_fila_pendencias.sql`, no editor SQL do banco central). Sem esse passo nada do automático funciona.
2. **Agendar a nova tentativa já no momento do erro**: hoje, quando o retorno do ERP chega com falha, o item vira "Com erro" mas não recebe horário de nova tentativa. Passa a receber (1, 5, 15 e depois 30 em 30 minutos).
3. **Agendar também na criação do item**: ao confirmar o pagamento, a linha já nasce com um prazo de nova tentativa, para o caso de o ERP nunca devolver resposta.
4. **Rede de segurança**: a rotina automática também vai recolher itens antigos com erro e sem horário marcado, em vez de ignorá-los.
5. **Reprocessar os dois lançamentos da rota erp-414** (NF 65246 e 65247) assim que os passos acima estiverem valendo, já que o ERP está no ar.

## Detalhes técnicos

- `src/routes/api/public/hooks/erp-fila-callback.ts`: ao gravar `status: "ERRO"`, gravar também `proxima_tentativa_em` (usando `minutosAteProximaTentativa`) e `raiz_id`.
- `src/lib/rota-pagamento.server.ts`: incluir `proxima_tentativa_em` no insert das duas filas.
- `src/lib/fila-retry.server.ts`: no `processarPendencias`, além de `lte("proxima_tentativa_em", agora)`, incluir os itens com `proxima_tentativa_em` nulo (`or(...)`), mantendo o limite de 50 por fila.
- Pré-requisito: migração `db/central/2026-09-23_fila_pendencias.sql` aplicada — as tabelas `fila_tentativas` e `notificacoes_pendencias` e as colunas de controle ainda não existem.
