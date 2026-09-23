# Por que os valores não foram contabilizados no ERP

## O que eu verifiquei agora

- O ERP **voltou a responder** (teste feito agora: resposta normal). O erro 502 mostrado nos dois itens da rota erp-414 (NF 65246 e 65247) foi uma indisponibilidade momentânea do servidor do ERP naquele horário, não um erro de dados.
- Os dois itens continuam parados **porque a atualização do banco ainda não foi aplicada**. As colunas e tabelas de controle das novas tentativas (`proxima_tentativa_em`, histórico de tentativas, avisos) não existem no banco central — confirmei consultando o banco.

Consequência prática: o app registrou o erro, mas não tem onde marcar "tentar de novo às X horas", então a rotina automática nunca pega esses itens. Por isso a tela mostra "Próxima tentativa automática: —" e nada acontece sozinho.

## O que vamos fazer

1. **Aplicar a atualização do banco** (script abaixo, no editor SQL do banco central). Sem esse passo nada do automático funciona.

```sql
-- Fila de pendências de integração (lançamento no ERP e tarefa no Bitrix).
ALTER TABLE speedflow.fila_lancamento_erp_frete
  ADD COLUMN IF NOT EXISTS raiz_id uuid,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz DEFAULT now() + interval '30 minutes',
  ADD COLUMN IF NOT EXISTS pausada_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_por uuid,
  ADD COLUMN IF NOT EXISTS resolvida_manual_motivo text;

ALTER TABLE speedflow.fila_provisionamento_financeiro
  ADD COLUMN IF NOT EXISTS raiz_id uuid,
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz DEFAULT now() + interval '30 minutes',
  ADD COLUMN IF NOT EXISTS pausada_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_em timestamptz,
  ADD COLUMN IF NOT EXISTS resolvida_manual_por uuid,
  ADD COLUMN IF NOT EXISTS resolvida_manual_motivo text;

UPDATE speedflow.fila_lancamento_erp_frete SET raiz_id = id WHERE raiz_id IS NULL;
UPDATE speedflow.fila_provisionamento_financeiro SET raiz_id = id WHERE raiz_id IS NULL;

CREATE INDEX IF NOT EXISTS fila_erp_proxima_tentativa_idx
  ON speedflow.fila_lancamento_erp_frete (status, proxima_tentativa_em);
CREATE INDEX IF NOT EXISTS fila_fin_proxima_tentativa_idx
  ON speedflow.fila_provisionamento_financeiro (status, proxima_tentativa_em);

CREATE TABLE IF NOT EXISTS speedflow.fila_tentativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fila text NOT NULL CHECK (fila IN ('valores', 'financeiro')),
  fila_id uuid NOT NULL,
  raiz_id uuid NOT NULL,
  tentativa integer NOT NULL DEFAULT 1,
  ok boolean NOT NULL DEFAULT false,
  mensagem text,
  origem text NOT NULL DEFAULT 'AUTOMATICA' CHECK (origem IN ('AUTOMATICA', 'MANUAL', 'CALLBACK')),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fila_tentativas_raiz_idx
  ON speedflow.fila_tentativas (raiz_id, criado_em DESC);

CREATE TABLE IF NOT EXISTS speedflow.notificacoes_pendencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canal text NOT NULL CHECK (canal IN ('EMAIL', 'WHATSAPP')),
  destinatario text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  assinatura text,
  ok boolean NOT NULL DEFAULT true,
  mensagem text,
  enviado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificacoes_pendencias_envio_idx
  ON speedflow.notificacoes_pendencias (canal, destinatario, enviado_em DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.fila_tentativas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON speedflow.notificacoes_pendencias TO authenticated;
GRANT ALL ON speedflow.fila_tentativas TO service_role;
GRANT ALL ON speedflow.notificacoes_pendencias TO service_role;
```

   Ao colar o script, o banco mostra o aviso "Potential issue detected" (tabelas novas sem Row Level Security). Escolha **"Run and enable RLS"** — as duas tabelas novas são de uso interno do app (histórico de tentativas e registro de avisos) e são lidas pelo servidor, então ligar a proteção é o certo e não afeta a tela.



2. **Agendar a nova tentativa já no momento do erro**: hoje, quando o retorno do ERP chega com falha, o item vira "Com erro" mas não recebe horário de nova tentativa. Passa a receber (1, 5, 15 e depois 30 em 30 minutos).
3. **Agendar também na criação do item**: ao confirmar o pagamento, a linha já nasce com um prazo de nova tentativa, para o caso de o ERP nunca devolver resposta.
4. **Rede de segurança**: a rotina automática também vai recolher itens antigos com erro e sem horário marcado, em vez de ignorá-los.
5. **Reprocessar os dois lançamentos da rota erp-414** (NF 65246 e 65247) assim que os passos acima estiverem valendo, já que o ERP está no ar.

## Detalhes técnicos

- `src/routes/api/public/hooks/erp-fila-callback.ts`: ao gravar `status: "ERRO"`, gravar também `proxima_tentativa_em` (usando `minutosAteProximaTentativa`) e `raiz_id`.
- `src/lib/rota-pagamento.server.ts`: incluir `proxima_tentativa_em` no insert das duas filas.
- `src/lib/fila-retry.server.ts`: no `processarPendencias`, além de `lte("proxima_tentativa_em", agora)`, incluir os itens com `proxima_tentativa_em` nulo (`or(...)`), mantendo o limite de 50 por fila.
- Pré-requisito: migração `db/central/2026-09-23_fila_pendencias.sql` aplicada — as tabelas `fila_tentativas` e `notificacoes_pendencias` e as colunas de controle ainda não existem.
