-- Ajuste manual (ADM) dos status "Valores" e "Financeiro" de cada CT-e.
-- Executar no banco central (esquema speedflow).

CREATE TABLE IF NOT EXISTS speedflow.cte_status_override (
  cte_id uuid PRIMARY KEY,
  valores text,
  financeiro boolean,
  definido_por uuid,
  definido_em timestamptz NOT NULL DEFAULT now()
);
