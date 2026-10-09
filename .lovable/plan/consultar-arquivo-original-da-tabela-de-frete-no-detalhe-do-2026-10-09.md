# Consultar arquivo original da tabela de frete no detalhe do CT-e

Classificação: **MINOR** (1.29.3 → 1.30.0) — nova funcionalidade compatível, sem mudança de banco.

## Objetivo

Na tela de detalhe do CT-e (`/ctes/:id`), na seção de auditoria, oferecer ao usuário um botão para **ver/baixar o arquivo original** (PDF, planilha etc.) da tabela de frete usada na auditoria — ou seja, a tabela vigente na emissão do CT-e.

## Como funciona hoje

- A auditoria grava `cte_auditorias.tabela_preco_id` (a tabela vigente na emissão).
- `CteDetailView.tsx` já carrega essa tabela (`tabelaUsada`), mas só seleciona `id, nome, data_inicio, data_fim, uf_destino, tipo_calculo`.
- O arquivo original fica no bucket `tabelas-frete` (storage), com `arquivo_path`, `arquivo_nome`, `arquivo_tipo` na tabela `tabelas_preco_frete`.
- A tela `tabelas-frete.tsx` já tem o padrão de abrir o arquivo: URL assinada de 5 min via `createSignedUrl` e `window.open`.

## Mudanças

1. **`src/components/ctes/CteDetailView.tsx`**
   - Ampliar o `select` da query `cte-tabela-auditoria` para incluir `arquivo_path, arquivo_nome, arquivo_tipo`.
   - Na seção de auditoria, junto ao nome/vigência da tabela usada, mostrar:
     - Botão **"Ver tabela original"** (ícone de arquivo) quando `arquivo_path` existir — abre o arquivo em nova aba via URL assinada (mesmo padrão de `tabelas-frete.tsx`, bucket `tabelas-frete`, cliente de storage do app).
     - Texto discreto "Tabela sem arquivo anexado" quando não houver arquivo.
   - Reutilizar a lógica de URL assinada extraindo um helper compartilhado (`src/lib/tabela-frete-arquivo.ts`) usado pelas duas telas, evitando duplicação.

2. **Fallback sem auditoria** (opcional, incluído): quando o CT-e ainda não foi auditado, buscar a tabela vigente na `data_emissao` para a transportadora do CT-e (mesma regra da auditoria) e oferecer o arquivo dela, com o rótulo "tabela vigente na emissão (auditoria ainda não executada)".

3. **Versionamento**: `src/config/version.ts` → 1.30.0 e entrada no `CHANGELOG.md`.

## Riscos

- Nenhum risco ao banco: somente leitura (tabela + storage já existentes, RLS já cobre o bucket para usuários autenticados).
- Tabelas antigas sem arquivo anexado simplesmente não mostram o botão.

## Checklist para publicar

- No preview: abrir um CT-e auditado (ex.: CT-e 19780/2 da SOLUTION), clicar em "Ver tabela original" e conferir que o arquivo abre em nova aba; testar um CT-e cuja tabela não tem arquivo (deve mostrar o aviso, sem botão).
- Migrações: nenhuma.
- Flags: nenhuma.
- Reverter: voltar à versão 1.29.3 pelo histórico do Lovable.
