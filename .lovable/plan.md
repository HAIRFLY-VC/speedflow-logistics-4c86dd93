# Pedidos sem rota: seleção automática só após filtrar

## Comportamento desejado

- Ao abrir a tela, os pedidos aparecem listados **sem nenhuma seleção**.
- Assim que o usuário marca itens em qualquer filtro (estado, cidade, bairro, agenda, filial), os pedidos exibidos na listagem já aparecem **selecionados**, e o rodapé mostra a contabilização (pedidos, entregas, valor, peso).
- Se o usuário limpar todos os filtros, a seleção não é recriada automaticamente (volta a ficar sob controle manual, como na primeira exibição).

## Alterações

Arquivo: `src/routes/_authenticated/pedidos-sem-rota.tsx`

1. Reintroduzir `useEffect` e `useRef` no import do React.
2. Recriar a chave `filtrosKey` (junção das seleções de uf, cidade, bairro, agenda e filial) e o `useRef` de primeira carga.
3. Adicionar `useEffect` que:
   - ignora a primeira renderização (primeira carga da listagem fica sem seleção);
   - só seleciona quando `filtrosKey` **não** está vazio (ou seja, há ao menos um item de filtro marcado);
   - nesse caso, marca todos os pedidos filtrados (`setSelecionados(filtradas.map((l) => l.id))`).
4. Manter intactos o checkbox "Selecionar todos os filtrados", a seleção por grupo de cliente e o rodapé de totais.

## Validação

- `bunx tsgo --noEmit` sem erros.
- Conferir na pré-visualização: primeira abertura sem seleção; marcar um estado no filtro → pedidos da listagem ficam marcados e o rodapé totaliza; desmarcar o filtro → seleção não volta sozinha.
