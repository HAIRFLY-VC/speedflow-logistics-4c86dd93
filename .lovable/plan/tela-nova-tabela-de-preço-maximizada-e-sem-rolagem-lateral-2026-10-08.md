# Tela "Nova tabela de preço" maximizada e sem rolagem lateral

Classificação: **PATCH** (v1.27.1) — ajuste visual, sem mudança de comportamento, banco ou integrações.

## Problema
O diálogo "Nova tabela de preço" (`src/routes/_authenticated/tabelas-frete.tsx`) usa largura fixa `max-w-3xl` e a grade "Preços por origem e destino" força `min-w-[900px]`, causando rolagem horizontal dentro do modal.

## Mudanças (somente `src/routes/_authenticated/tabelas-frete.tsx`)

1. **Diálogo maximizado**
   - `DialogContent`: de `max-w-3xl` para `w-[96vw] max-w-[1400px] max-h-[92vh] overflow-y-auto`, aproveitando quase toda a tela em monitores desktop.

2. **Grade "Preços por origem e destino" sem rolagem lateral**
   - Remover `min-w-[900px]` e `overflow-x-auto` do cabeçalho e das linhas.
   - Redistribuir as 11 colunas com frações menores e `min-w-0`, inputs com `h-8 px-2 text-xs` para caberem na largura disponível.
   - Cabeçalhos com `text-[11px]` e quebra em duas linhas quando necessário.

3. **Demais seções**
   - Manter o grid de 3 colunas dos campos gerais (já se adapta); garantir `min-w-0` nos containers para evitar estouro.
   - Grade "Faixas de peso" já cabe; apenas garantir consistência de tamanho dos inputs.

4. **Versionamento**
   - `src/config/version.ts` → 1.27.1 e entrada no `CHANGELOG.md` (### Corrigido: diálogo de tabela de preço maximizado e sem rolagem lateral).

## Riscos
- Nenhum risco a banco, ERP ou versão publicada: apenas classes de layout em um componente.

## Checklist para publicar
- Testar no preview: abrir "Nova tabela" e "Editar tabela", conferir que não há rolagem horizontal e que todos os campos aparecem.
- Migrações: nenhuma.
- Flags: nenhuma.
- Reversão: voltar à versão anterior no histórico do Lovable.
