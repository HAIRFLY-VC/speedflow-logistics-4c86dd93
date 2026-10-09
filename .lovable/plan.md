# Frete provisionado no detalhamento "Mercadorias faturadas" (v1.36.0 — MINOR)

## O que muda para o usuário
- Na tela Mercadorias faturadas, quando a nota não tiver VLR_FRETE informado pelo ERP (vazio ou zero), o app procura o provisionamento dessa nota (gravado em "Autorizar pagamento de frete") e exibe os valores provisionados nas colunas VLR_FRETE, VLR_PERNA, VLR_DIARIA, VLR_PERNOITE, VLR_REENTREGA e VLR_DESCARREGO.
- Nova coluna **ORIGEM_FRETE**, logo após VLR_FRETE:
  - **R** = valor real (veio do ERP)
  - **P** = valor provisionado
  - vazio = sem frete real nem provisionado
- O card "Vlr. Frete" no topo passa a somar real + provisionado, com a divisão "Real R$ x / Provisionado R$ y".
- A exportação para Excel inclui a nova coluna e os valores provisionados.
- Filtro/ordenação funcionam também na nova coluna.

## Regras
- Frete real sempre tem prioridade; o provisionado só entra quando o real é nulo ou zero.
- Só vale provisionamento ativo (status A) da mesma nota e filial.
- Se a consulta das provisões falhar, a tela continua carregando com os valores reais e mostra um aviso discreto.

## Riscos para a versão publicada
- Nenhuma alteração no banco compartilhado nem no ERP — apenas leitura da tabela de provisões que já existe.
- Consulta extra ao ERP ao abrir a tela (feita em lotes para não pesar).

## Detalhes técnicos
- Nova server function `listarProvisoesNotas` (autenticada) em `src/lib/provisao-frete.functions.ts`: recebe pares filial/NF, consulta `gks.a_ger_provisao_frete` (status = 'A') em lotes de ~500 NFs via `/v1/query`, retornando `sum(vlr_frete)` por filial+NF.
- `carregarMercadorias` (`src/lib/custo-frete.query.ts`): após carregar as notas, chama a função para as NFs sem `vlr_frete`, preenche o valor e adiciona `origem_frete: "R" | "P" | null` em `LinhaMercadoria`.
- `src/routes/_authenticated/custo-frete-mercadorias.tsx`: coluna ORIGEM_FRETE, totais real/provisionado, exportação.
- `src/config/version.ts` → 1.36.0 e entrada no `CHANGELOG.md`.

## Checklist para publicar
1. Abrir Mercadorias faturadas de out/26 e conferir notas de rotas já provisionadas com origem P.
2. Notas com frete do ERP devem continuar com origem R e mesmo valor.
3. Sem migrações nem flags; reversão: voltar à v1.35.0.
