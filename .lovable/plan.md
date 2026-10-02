# Nome do arquivo sugerido ao salvar impressão da rota (RT_461_20261002.pdf)

## Classificação
PATCH v1.18.2 — mudança de apresentação, sem risco para produção e sem migração de banco.

## O que muda
Ao imprimir / salvar PDF uma rota, o navegador deve sugerir o nome do arquivo:

```text
RT_<código da rota>_<data de impressão yyyyMMdd>.pdf
```

Ex.: rota 461 impressa em 02/10/2026 → `RT_461_20261002.pdf`

## Como funciona (Detalhes técnicos)
- Navegadores (Chrome/Edge/Firefox) usam o **título da aba** como nome sugerido no diálogo "Salvar como PDF". Não há API para definir o nome diretamente.
- Em `src/components/print/RotaPrintDocument.tsx`:
  - Calcular `RT_<codigo>_<yyyymmdd>`, onde:
    - `<codigo>` = `route.erp_route_id ?? route.code` (mesmo critério do título atual da impressão);
    - `<yyyymmdd>` = data local do momento da impressão, formatada sem separadores (ex.: `20261002`).
  - Num `useEffect` (executa quando a rota é carregada), definir `document.title` como esse valor (sem `.pdf` — o navegador acrescenta a extensão) e restaurar o título original no cleanup (desmontagem / troca de rota).
  - Enquanto o código da rota não estiver carregado, manter o título padrão da página.
- `PrintLayout.tsx`, `print.css` e demais arquivos de impressão permanecem inalterados.
- O selo "TESTE · v..." e o rodapé da folha não são afetados (o título da aba não aparece no papel impresso).

## Limitação
- O nome é a *sugestão* do diálogo de salvamento: funciona em Chrome/Edge/Firefox; o usuário ainda pode editá-lo antes de salvar.
- Fluxo atual (mesma aba, sem nova aba/login) permanece igual — nada muda no comportamento do botão "Imprimir / Salvar PDF".

## Versão e changelog
- `src/config/version.ts`: 1.18.0 → **1.18.2**.
- `CHANGELOG.md`: nova entrada no topo, em português:
  - ### Adicionado — Ao salvar a impressão da rota em PDF, o arquivo é sugerido como RT_<código da rota>_<data>.pdf (ex.: RT_461_20261002.pdf).

## Checklist para publicar
- **Testar no preview:** abrir Rotas Pendentes → imprimir uma rota (ex.: 461) → no diálogo de impressão "Salvar como PDF", conferir que o nome sugerido é `RT_461_20261002.pdf` (ajustando à rota e data do dia).
- **Migrações:** nenhuma.
- **Flags:** nenhuma alteração.
- **Reverter:** restaurar a versão 1.18.1 pelo histórico do Lovable (sem reversão de banco).
