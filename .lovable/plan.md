# Rotas 419 e 421 sem botão "Confirmar Pgto"

## Causa
O script do PIX ainda não foi rodado no banco. Por isso, quando a tela tenta ler o cadastro de transportadores, recebe o erro "a coluna pix não existe" e fica sem nenhum cadastro. Resultado: a coluna **Tipo** aparece "—" em todas as rotas. Sem saber que 419 e 421 são de fretista, a tela não mostra o campo de valor do frete e o botão "Confirmar Pgto" não aparece. As rotas 414 e 416 só aparecem normais porque o pagamento delas já foi confirmado.

## O que fazer
1. **Você:** rodar no banco o script `erp_responsaveis_pix.sql` enviado antes (uma linha: `ALTER TABLE speedflow.erp_responsaveis ADD COLUMN IF NOT EXISTS pix text;`). Depois, clicar em "Atualizar cadastro" na tela Transportadoras.
2. **Eu (proteção para não acontecer de novo):** se a leitura com PIX falhar porque a coluna não existe, a tela vai ler o cadastro de novo sem o PIX. Assim o Tipo e o botão continuam funcionando. Vale para a lista de responsáveis na tela de rotas (`RotasView.tsx`) e para `rota-responsavel.ts` / `listarResponsaveisErp`.
3. Conferir na tela que 419 e 421 mostram o Tipo "F", o campo de valor e o botão Confirmar Pgto (que ainda depende de valor digitado, borderô completo e auditoria "Rota completa").
