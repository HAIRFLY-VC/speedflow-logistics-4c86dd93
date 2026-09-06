-- Filial do pedido (COD_FILIAL do ERP), usada como filtro na tela
-- "Pedidos sem rota".
ALTER TABLE speedflow.orders ADD COLUMN IF NOT EXISTS cod_filial text;

CREATE INDEX IF NOT EXISTS orders_cod_filial_idx ON speedflow.orders (cod_filial);
