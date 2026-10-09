# Busca de praça pelo nome do município (v1.31.0, MINOR)

## O que muda
No modal "Provisionar frete da transportadora", o combo "Selecionar praça…" vira um campo de busca:
- O usuário digita parte do nome do município (ex.: "capib", "santa cruz"). Acentos e maiúsculas não importam.
- A lista vai filtrando enquanto digita e mostra cada **município** com o **nome da praça** ao lado. Exemplo: "SANTA CRUZ DO CAPIBARIBE — CARUARU INTERIOR".
- Ao escolher um município, o app usa a praça dele, como hoje, e recalcula.
- A busca também encontra pelo nome da praça. As praças continuam listadas no fim, para escolher direto quando a cidade não estiver cadastrada em nenhuma.
- Quando o campo abre, ele já vem preenchido com a cidade da entrega, para mostrar na hora as sugestões parecidas.

## Riscos
- Só muda a tela. Não muda o banco nem o cálculo.

## Checklist para publicar
- Abrir a rota 392, clicar em "Selecionar praça…" em SANTA CRUZ DO CAPIBARIBE, digitar "capib" e escolher uma opção. O frete deve ser calculado.
- Reverter: versão 1.30.4 no histórico.

## Detalhes técnicos
- `provisao-frete.server.ts`: incluir em `pracas` a lista `municipios` (via `municipiosAprendidos(observacao)`); atualizar o tipo em `provisao-frete.types.ts`.
- `ProvisaoFreteDialog.tsx`: trocar o `Select` por `Popover` + `Command` (shadcn), com filtro normalizado sem acento e itens "município — praça". Selecionar chama a mesma mutação `definirPracaMunicipio` com o `rotaId` da praça.
- `version.ts` e `CHANGELOG.md`.
