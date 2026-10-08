# Provisionamento de frete para rotas de transportadora

## Objetivo
Na tela "Autorizar pagamento de frete", para rotas do tipo T (transportadora), o app calcula o custo previsto do frete usando a tabela de frete da transportadora, grava esse provisionamento numa nova tabela do ERP e a rota passa a "Confirmado".

## Como vai funcionar para o usuário
1. Rotas do tipo T mostram um botão "Provisionar frete" (no lugar do "Confirmar Pgto" usado para fretistas).
2. Ao clicar, abre um modal com o cálculo por nota fiscal: tabela usada, praça encontrada, peso, valor da mercadoria, frete peso, ad valorem, GRIS, taxas, mínimo e o total. Notas sem praça encontrada aparecem com crítica e bloqueiam a gravação.
3. As mesmas travas atuais continuam valendo: borderô em todos os pedidos, expedição completa e sem pedidos não faturados.
4. Ao confirmar, o app grava uma linha por nota no ERP. Quando todas as linhas forem confirmadas, a rota fica "Confirmado" e a coluna Frete (R$) mostra o total provisionado.
5. Se o ERP falhar, a rota fica "Confirmado c/ pendência" e entra na fila de reenvio automático que já existe (10 tentativas, 1 por minuto).
6. Rotas sem tabela de frete vigente para a transportadora mostram a crítica "Transportadora sem tabela de frete vigente".

## Tabela no ERP (script Oracle gerado e disponibilizado para download)
`GKS.A_GER_PROVISAO_FRETE`
- `ID` NUMBER (sequência `GKS.SEQ_PROVISAO_FRETE`), chave primária
- `ID_ROTA` NUMBER, `COD_FILIAL` NUMBER, `NRO_NF` NUMBER, `BORDERO` NUMBER, `COD_PEDIDO` NUMBER
- `COD_TRANSP` VARCHAR2(20)
- `VLR_FRETE`, `VLR_PERNA`, `VLR_DIARIA`, `VLR_PERNOITE`, `VLR_REENTREGA`, `VLR_DESCARREGO` NUMBER(15,2) — as mesmas colunas de valores da `A_GERENTREGAS`
- `MEMORIA_CALCULO` CLOB (JSON com tabela, praça, componentes e parâmetros usados) com checagem `IS JSON`
- `CHAVE_CTE` VARCHAR2(44) (vazia, para a futura comparação com o CT-e)
- `STATUS` CHAR(1) default 'A' (A = ativo, S = substituído), `DT_PROVISAO` DATE default SYSDATE, `USUARIO` VARCHAR2(100)
- Índices em (ID_ROTA), (COD_FILIAL, NRO_NF, BORDERO)
- Junto: exemplos de SQL para os endpoints da API do ERP (`insert_provisao_frete` e `update_status_provisao`)

Reprovisionar uma rota marca as linhas anteriores como 'S' e grava novas. Nada é apagado.

## Pré-requisito do seu lado
A API do ERP só executa comandos já cadastrados. Depois de criar a tabela, é preciso cadastrar os dois endpoints com o SQL do script. Até lá, a gravação fica na fila com pendência.

## Riscos para a versão publicada
- Nenhuma mudança destrutiva no banco do app. Só uma coluna nova opcional nas rotas (`frete_provisionado_em`) e o tipo novo na fila de reenvio, compatíveis com a versão publicada.
- O fluxo de fretista (Confirmar Pgto, Bitrix, gravação na A_GERENTREGAS) não muda.
- Classificação: MINOR (v1.24.0). Fica atrás de uma feature flag ativa no teste e na oficial (conforme sua preferência).

## Detalhes técnicos
- Cálculo no servidor reaproveitando o motor de `cte-audit.server.ts` / `frete-simulacao.ts` (tabela vigente pela data da rota, via `tabelas_preco_frete_transportadoras`), por NF agrupando os pedidos da NF. Valor vai em `VLR_FRETE`; demais campos ficam 0, a menos que a tabela tenha componente mapeado em `mapeamento_componentes_erp`.
- Novo `src/lib/provisao-frete.server.ts` + `provisao-frete.functions.ts` (requireSupabaseAuth, perfil Administrador/Gestor), conferência pós-gravação via `/v1/query` como já é feito com `update_vlr_gerentregas`.
- Migração central `db/central/2026-10-08_provisao_frete.sql`: `routes.frete_provisionado_em`, `routes.frete_provisionado_valor` (nullable) e valor `provisao` aceito em `fila_tentativas.fila`. A rota também recebe `frete_confirmado_em`, reaproveitando a lógica de status atual em `RotasView.tsx`.
- Script Oracle em `db/erp/2026-10-08_a_ger_provisao_frete.sql`, copiado para Files com link de download.
- Novo modal `ProvisaoFreteDialog.tsx`, aberto pelo lápis em rotas tipo T.
- Atualizar `version.ts`, `CHANGELOG.md`, tipos centrais.

## Checklist para publicar
- Rodar o script Oracle e cadastrar os endpoints na API do ERP.
- Testar no preview uma rota T (ex.: 420, 1 entrega) e conferir a linha gravada no ERP.
- Reverter: versão anterior no histórico + `DROP TABLE GKS.A_GER_PROVISAO_FRETE` (opcional).
