-- Rotas cujo borderô já foi emitido no ERP deixam de voltar na consulta de
-- pedidos pendentes. Em vez de serem apagadas, ficam marcadas com a data de
-- emissão do borderô e o número do borderô é guardado em cada pedido.
ALTER TABLE speedflow.orders ADD COLUMN IF NOT EXISTS bordero text;
COMMENT ON COLUMN speedflow.orders.bordero IS 'Número do borderô do pedido (MAX(GKS.A_GERENTREGAS.BORDERO)).';

ALTER TABLE speedflow.routes ADD COLUMN IF NOT EXISTS bordero_emitido_em timestamptz;
COMMENT ON COLUMN speedflow.routes.bordero_emitido_em IS 'Momento em que a rota deixou de voltar do ERP por ter borderô emitido.';

CREATE INDEX IF NOT EXISTS routes_bordero_emitido_em_idx ON speedflow.routes (bordero_emitido_em);
