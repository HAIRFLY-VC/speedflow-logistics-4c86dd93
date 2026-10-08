# Crítica: transportadora sem tabela de frete vigente — Autorizar pagamento de frete

## Contexto
Na tela "Autorizar pagamento de frete", rotas do tipo **T** (transportadora) cujo responsável não tem tabela de frete vigente vinculada hoje aparecem com frete "—" sem explicar o motivo. O provisionamento (lápis) só mostra o detalhe dentro do modal. O usuário quer uma crítica visível na própria listagem.

O cálculo necessário já existe em `RotasView.tsx`: `tabelasQ` (tabelas ativas), `vinculosQ` (vínculos N:N), `transpPorRota` (transportadora resolvida por rota) e `tabelaVigenteDaTransportadora()` — usados hoje só dentro do memo `estimativas`.

## Mudanças

### 1. `src/components/routes/RotasView.tsx`
- Novo memo `rotasSemTabela` (`Set<string>`): para cada rota com `tipoFreteOf(r) === "T"` e transportadora resolvida por `transpPorRota`, verificar `tabelaVigenteDaTransportadora(tabelas, vinculos, transportadoraId)`; quando não houver tabela vigente, adicionar `r.id` ao set. Dependências: `data`, `tabelasQ.data`, `vinculosQ.data`, `transpPorRota`, `responsavelPorRota`.
- Na coluna **Frete (R$)**, passar novo prop ao `FreightInput`:
  - `avisoTabela` = quando `permitirConfirmacao && rotasSemTabela.has(r.id)`, objeto `{ mensagem: "Transportadora sem tabela de frete vigente vinculada. Use o lápis para vincular uma tabela e calcular o provisionamento." }`.
- Em `FreightInput`:
  - Novo prop opcional `avisoTabela?: { mensagem: string } | null`.
  - Renderizar como bloco de crítica (texto pequeno âmbar/vermelho com ícone `AlertTriangle`), no mesmo ponto onde hoje aparecem `avisoTipoEl`/`avisoPix` nos três retornos (valor vazio, valor confirmado e campo editável).

### 2. Versão e changelog
- `src/config/version.ts`: 1.24.4 → **1.24.5** (MINOR).
- `CHANGELOG.md`: entrada no topo — "Adicionado: crítica na Autorização de pagamento quando a transportadora da rota não tem tabela de frete vigente vinculada."

## Escopo
- Somente frontend; sem migração de banco, sem chamadas ao ERP.
- Não muda bloqueios do botão "Confirmar Pgto" nem o fluxo do provisionamento — apenas sinalização visual.

## Checklist para publicar
- No preview, abrir "Autorizar pagamento de frete" e conferir a crítica nas rotas tipo T sem tabela (ex.: transportadoras recém-cadastradas).
- Vincular tabela pelo lápis e conferir que a crítica desaparece após o recálculo.
- Migrações: nenhuma. Flags: nenhuma nova.
- Reverter: versão 1.24.4 no histórico do Lovable.
