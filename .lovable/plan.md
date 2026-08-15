# Ajustes na listagem de CT-e e abertura do detalhamento

## 1. Abrir o detalhamento sem pedir login de novo

Hoje o clique na linha usa `window.open(url, "_blank")`. No preview, a nova aba abre em um domínio diferente do que está autenticado, então a sessão não é encontrada e o app cai na tela de login.

Correção: navegar dentro da própria aba, usando a navegação interna do app para `/ctes/{id}` (a página de detalhamento já existe e já tem botão "Voltar para CT-e"). Sem nova aba, a sessão é preservada em qualquer ambiente.

## 2. Coluna "Tipo" compacta

- Exibir apenas "C" (complementar) ou "N" (normal), mantendo as cores atuais (âmbar para complementar, azul para normal).
- Ao passar o mouse, mostrar o texto completo "Complementar" ou "Normal".

## 3. Peso taxado com duas casas decimais

Formatar sempre com exatamente 2 casas decimais no padrão pt-BR (ex.: `1.234,50 kg`).

## 4. Nova coluna: empresa detentora do certificado A1

Exibir o CNPJ do destinatário/empresa vinculada ao CT-e (campo de empresa do registro) com a razão social abaixo, no mesmo estilo já usado na coluna de transportadora.

## 5. Nova coluna: destinatário

Exibir o CNPJ do destinatário com a razão social abaixo, usando o mesmo dado já mostrado no detalhamento do CT-e.

## Detalhes técnicos

- `src/routes/_authenticated/ctes.index.tsx`
  - `onRowClick`: trocar `window.open` por `navigate({ to: "/ctes/$cteId", params: { cteId: c.id } })` via `useNavigate` do TanStack Router.
  - Coluna `tipo`: `<Badge title="Complementar|Normal">C|N</Badge>`, mantendo as classes de cor atuais.
  - Coluna `peso`: `toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
  - Nova coluna `empresa`: query em `empresas` (id, cnpj, razao_social) mapeada por `cte.empresa_id`; fallback para "—" quando não vinculada.
  - Nova coluna `destinatario`: `c.cnpj_destinatario` + `c.nome_destinatario` (mesma fonte usada no detalhamento).
- Colunas novas entram no mesmo `ColumnDef[]`, portanto ficam disponíveis no gerenciador de colunas/filtros da tabela.
