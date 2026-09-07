# Plano: Pedidos sem rota devem começar desmarcados

## Problema
Na tela **Pedidos sem rota** (`/_authenticated/pedidos-sem-rota`), todos os pedidos aparecem selecionados assim que a listagem carrega. O esperado é que a primeira exibição venha sem nenhuma seleção, deixando o usuário escolher manualmente.

## Causa
Em `src/routes/_authenticated/pedidos-sem-rota.tsx` há um `useEffect` que acompanha `pedidosQ.data` e, após a primeira carga, preenche `selecionados` com todos os IDs filtrados:

```text
// linhas ~264-275
useEffect(() => {
  if (primeiraCarga.current) {
    primeiraCarga.current = false;
    return;
  }
  if (!filtrosKey) return;
  setSelecionados(filtradas.map((l) => l.id));
}, [filtrosKey, pedidosQ.data]);
```

A intenção original era facilitar a seleção em massa, mas o resultado é uma seleção total automática indesejada.

## Solução
Remover o auto-selecionamento por efeito. A seleção em massa continuará disponível via checkbox **"Selecionar todos os filtrados** no topo da lista, e o usuário decide quando usar.

### Alterações
1. `src/routes/_authenticated/pedidos-sem-rota.tsx`
   - Remover o `useEffect` que seta `selecionados` a partir de `filtrosKey` / `pedidosQ.data`.
   - Remover a constante `filtrosKey` e o `useRef(primeiraCarga)`, pois deixam de ser usados.
   - Manter o estado inicial `selecionados = []` e todo o restante da lógica (checkbox "Selecionar todos", seleção por grupo, resumo no rodapé, Sheet de atribuição).

## Validação
- Rodar `bunx tsgo --noEmit` para confirmar tipos.
- Abrir a tela e confirmar que nenhum pedido vem marcado inicialmente.
- Confirmar que o checkbox "Selecionar todos os filtrados" ainda funciona.
- Confirmar que os filtros continuam cruzados e as contagens do rodapé permanecem corretas.
