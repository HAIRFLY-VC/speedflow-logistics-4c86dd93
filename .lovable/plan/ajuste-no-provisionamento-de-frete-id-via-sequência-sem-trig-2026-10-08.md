# Ajuste no provisionamento de frete: ID via sequência, sem trigger

## O que muda
Em vez de uma trigger preencher o ID da tabela `GKS.A_GER_PROVISAO_FRETE`, o app consulta o próximo valor da sequência antes de gravar — mesmo padrão já usado no cadastro de rota (`SEQ_ROTA_ID`).

## Passos
1. **Script Oracle (v3, novo download):** remove a trigger do script. Ficam apenas: `CREATE SEQUENCE GKS.SEQ_PROVISAO_FRETE`, `CREATE TABLE GKS.A_GER_PROVISAO_FRETE` (com `ID` NUMBER obrigatório, chave primária, sem default) e os índices. Se a sequência ou a tabela já existirem de tentativas anteriores, o script traz comandos de limpeza comentados.
2. **App:** antes de cada insert no ERP, o app executa `SELECT GKS.SEQ_PROVISAO_FRETE.NEXTVAL FROM DUAL` via `/v1/query` e envia o ID obtido no bind do comando `insert_provisao_frete`. Se a consulta da sequência falhar, nada é gravado e a rota fica com pendência na fila de reenvio.
3. **Endpoint da API do ERP:** o SQL de exemplo do `insert_provisao_frete` no script passa a receber o bind `id` (além dos demais), igual ao padrão do `insert_ger_rota`.

## Riscos
- Nenhum para a versão publicada: mudança só no script novo e no fluxo de provisionamento (v1.24.0, ainda não testado com o ERP).
- Sem mudança no banco compartilhado do app.

## Checklist para publicar
- Rodar o script v3 no Oracle (sem trigger) e cadastrar o endpoint `insert_provisao_frete` com o bind `id`.
- Testar no preview uma rota tipo T e conferir a linha gravada com o ID da sequência.
- Reverter: versão anterior no histórico do Lovable + `DROP TABLE GKS.A_GER_PROVISAO_FRETE` (opcional).
