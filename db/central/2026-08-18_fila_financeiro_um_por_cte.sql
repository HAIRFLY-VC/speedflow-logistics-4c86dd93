-- Provisionamento financeiro: exatamente 1 registro por CT-e.
-- Executar no banco central (esquema speedflow).

-- 1) Remove eventuais duplicidades, mantendo o registro mais recente por CT-e
DELETE FROM speedflow.fila_provisionamento_financeiro f
USING speedflow.fila_provisionamento_financeiro g
WHERE f.cte_id IS NOT NULL
  AND f.cte_id = g.cte_id
  AND (f.created_at, f.id) < (g.created_at, g.id);

-- 2) Registros órfãos (sem CT-e) não fazem sentido nesta fila
DELETE FROM speedflow.fila_provisionamento_financeiro WHERE cte_id IS NULL;

-- 3) cte_id passa a ser obrigatório e a chave natural da fila
ALTER TABLE speedflow.fila_provisionamento_financeiro
  ALTER COLUMN cte_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fila_fin_cte_unq
  ON speedflow.fila_provisionamento_financeiro (cte_id);

-- ordem_pagamento_id já é UNIQUE (1 ordem = 1 CT-e); índice mantido por clareza
CREATE UNIQUE INDEX IF NOT EXISTS fila_fin_ordem_unq
  ON speedflow.fila_provisionamento_financeiro (ordem_pagamento_id);
