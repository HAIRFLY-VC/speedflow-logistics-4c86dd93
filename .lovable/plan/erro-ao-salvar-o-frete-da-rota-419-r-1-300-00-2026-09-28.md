# Erro ao salvar o frete da rota 419 (R$ 1.300,00)

## Causa confirmada
O servidor respondeu: "Could not find the 'cod_responsavel_pix' column of 'ordens_pagamento_frete'". A confirmação agora grava o PIX usado, o favorecido e o código do fretista na ordem de pagamento (proteção contra troca de PIX). Mas o script do banco central que cria essas colunas (`db/central/2026-09-24_pix_controle.sql`) não foi executado. Por isso a gravação falha.

## O que fazer
1. Você executa no banco central o script abaixo (se aparecer aviso de segurança, escolha "Run and enable RLS"):

```sql
ALTER TABLE speedflow.ordens_pagamento_frete
  ADD COLUMN IF NOT EXISTS pix_utilizado text,
  ADD COLUMN IF NOT EXISTS favorecido_pix text,
  ADD COLUMN IF NOT EXISTS cod_responsavel_pix text;

CREATE INDEX IF NOT EXISTS ordens_pagamento_frete_cod_resp_pix_idx
  ON speedflow.ordens_pagamento_frete (cod_responsavel_pix, created_at DESC);

CREATE TABLE IF NOT EXISTS speedflow.pix_liberacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_erp text NOT NULL,
  pix_anterior text,
  pix_novo text NOT NULL,
  liberado_por uuid,
  liberado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pix_liberacoes_cod_idx
  ON speedflow.pix_liberacoes (cod_erp, liberado_em DESC);
GRANT SELECT ON speedflow.pix_liberacoes TO authenticated;
GRANT ALL ON speedflow.pix_liberacoes TO service_role;
ALTER TABLE speedflow.pix_liberacoes ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
```

2. Depois disso, eu confirmo que as colunas aparecem para o app e você salva de novo o frete da rota 419.
3. Melhoria no app: se faltar uma coluna ou tabela no banco, mostrar uma mensagem clara ("O banco central precisa ser atualizado — avise o administrador") em vez do texto técnico.
