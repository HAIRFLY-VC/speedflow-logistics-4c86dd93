# Impressão da rota: nome do arquivo sugerido + contador de páginas

## Classificação
PATCH v1.18.2 — mudança de apresentação, sem risco para produção e sem migração de banco.

## O que muda
1. Ao imprimir / salvar PDF uma rota, o navegador deve sugerir o nome do arquivo:

```text
RT_<código da rota>_<data de impressão yyyyMMdd>.pdf
```

Ex.: rota 461 impressa em 02/10/2026 → `RT_461_20261002.pdf`

2. Contador de páginas no canto inferior direito de cada página impressa, no formato
   `Página X de Y`. Esse contador **já existe** no módulo de impressão (via `@page @bottom-right` em
   `PrintLayout.tsx`) e foi verificado funcionando na saída de impressão: ele só não aparece na
   pré-visualização na tela, porque esse rodapé só existe no papel/PDF. O plano garante que ele
   permaneça posicionado no canto inferior direito e o valida no PDF final.

## Como funciona (Detalhes técnicos)
- Navegadores (Chrome/Edge/Firefox) usam o **título da aba** como nome sugerido no diálogo "Salvar como PDF". Não há API para definir o nome diretamente.
- Em `src/components/print/RotaPrintDocument.tsx`:
  - Calcular `RT_<codigo>_<yyyymmdd>`, onde:
    - `<codigo>` = `route.erp_route_id ?? route.code` (mesmo critério do título atual da impressão);
    - `<yyyymmdd>` = data local do momento da impressão, formatada sem separadores (ex.: `20261002`).
  - Num `useEffect` (executa quando a rota é carregada), definir `document.title` como esse valor (sem `.pdf` — o navegador acrescenta a extensão) e restaurar o título original no cleanup (desmontagem / troca de rota).
  - Enquanto o código da rota não estiver carregado, manter o título padrão da página.
- `PrintLayout.tsx`, `print.css` e demais arquivos de impressão permanecem inalterados quanto ao contador (já implementado e verificado); nada muda no comportamento do botão "Imprimir / Salvar PDF".
- O selo "TESTE · v..." e o rodapé da folha não são afetados (o título da aba não aparece no papel impresso).

## Limitações
- O nome do arquivo é a *sugestão* do diálogo de salvamento: funciona em Chrome/Edge/Firefox atuais; o usuário ainda pode editá-lo antes de salvar.
- O contador `Página X de Y` só é visível no diálogo de impressão e no PDF salvo — não na tela do app (limitação do formato de impressão contínuo). Em testes com Chromium foi confirmado que ele aparece no PDF gerado.

## Versão e changelog
- `src/config/version.ts`: 1.18.0 → **1.18.2**.
- `CHANGELOG.md`: nova entrada no topo, em português:
  - ### Adicionado — Ao salvar a impressão da rota em PDF, o arquivo é sugerido como RT_<código da rota>_<data>.pdf (ex.: RT_461_20261002.pdf).

## Checklist para publicar
- **Testar no preview:** abrir Rotas Pendentes → imprimir uma rota (ex.: 461) → no diálogo de impressão "Salvar como PDF", conferir:
  - nome sugerido `RT_461_20261002.pdf` (ajustando à rota e data do dia);
  - contador `Página X de Y` no canto inferior direito de cada página do PDF salvo.
- **Migrações:** nenhuma.
- **Flags:** nenhuma alteração.
- **Reverter:** restaurar a versão 1.18.1 pelo histórico do Lovable (sem reversão de banco).
