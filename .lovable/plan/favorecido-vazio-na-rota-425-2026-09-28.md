# Favorecido vazio na rota 425

## Causa (confirmada no banco)
A rota 425 está gravada no app **sem fretista e sem código** (a 426, corrigida antes, tem ROBSON / 202487). A listagem mostra o fretista porque consulta o ERP na hora, mas a janela do lápis só usa o que está gravado no app — por isso "Favorecido: —". A correção anterior só vale para rotas trazidas do ERP depois dela; rotas já existentes, como a 425, continuaram vazias.

## O que muda
1. Ao abrir o lápis, se a rota não tiver fretista gravado, o app busca o fretista da rota no ERP, grava nome e código na rota e mostra o favorecido (ex.: SANDRO NEVES PEREIRA, código 200999). A chave PIX continua oculta.
2. A mesma busca vale na confirmação do pagamento, para o servidor nunca validar o PIX sem o fretista.
3. Preenchimento único de todas as rotas do ERP que hoje estão sem fretista/código, usando o fretista informado no ERP.

## Detalhes técnicos
- `pix-controle.server.ts` / `codResponsavelDaRota`: quando `erp_carrier_code` e `driver_name` estão vazios e há `erp_route_id`, consultar no ERP o fretista dos pedidos da rota (mesma consulta usada pela listagem/sync da 426), gravar `driver_name` e `erp_carrier_code` em `routes` e retornar o código.
- Rodar uma vez essa rotina para as rotas com `erp_route_id` e sem `erp_carrier_code`.
- Verificação: tsgo e abrir o lápis da rota 425 via Playwright, conferindo o favorecido.
