# Corrigir fretista fantasma nas rotas sem responsável

## O que está acontecendo (confirmado)

No ERP, as rotas **418 (M- GBEX)** e **411 (M- MANOEL)** estão sem responsável: o campo de fretista/transportadora vem vazio, e no nosso banco também não há fretista vinculado a elas.

Mesmo assim a tela mostra ". (1027034)". O motivo: existe no cadastro do ERP um responsável cuja razão social é apenas um ponto (código 1027034, frota própria). Quando a rota não tem responsável nem nome de motorista, a tela tenta adivinhar o responsável **comparando nomes** — e o nome vazio da rota acaba "combinando" com esse cadastro de nome vazio. Resultado: toda rota sem responsável herda esse código.

## O que vou fazer

- Deixar de adivinhar o responsável por nome quando a rota não tem nome de motorista.
- Ignorar cadastros do ERP sem nome útil (como o "."), para que nunca sejam sugeridos como responsável de nenhuma rota.
- Quando a rota realmente não tem responsável, exibir o traço "—" na coluna **Fret / Transp** e deixar o tipo de frete em branco, em vez de mostrar um código inventado.
- Não mostrar um código solto quando não houver nome de responsável associado.

## Verificação

- Abrir Rotas Pendentes e conferir que 418 e 411 aparecem sem fretista ("—").
- Conferir que as rotas que realmente têm responsável no ERP (por exemplo, as que trazem os códigos 205630 e 202487) continuam exibindo nome e código corretamente.

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`:
  - em `responsavelPorRota`, o fallback `porNome` usa `normalizaNome(...)`, que reduz "." a string vazia; a comparação `alvo === nome` casa duas strings vazias. Passar a exigir `nome.length >= 4` **e** `alvo.length >= 4` antes de qualquer comparação.
  - em `resolveTransportadora`, aplicar a mesma guarda ao nome do cadastro comparado.
  - em `motoristaOf`, retornar vazio quando não houver nome, evitando exibir só o código.
- Nenhuma alteração de banco ou de integração com o ERP.
