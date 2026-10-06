# Plano: Remover botões de ciclo local da tela de detalhe da rota

## O que muda
Na tela de detalhe da rota (`/rotas/:id`), remover os botões que alteram status apenas no app (sem refletir no ERP):
- "Iniciar rota"
- "Cancelar"
- "Concluir rota" (contraparte do "Iniciar rota", aparece quando a rota está em andamento)
- "Emitir borderô" (emissão local de borderô)

O botão **"Excluir rota"** (rotas vazias, grava status E no ERP) permanece.

## Arquivo
`src/routes/_authenticated/rotas.$routeId.tsx`:
- Remover o bloco de botões (linhas ~575–631), preservando "Excluir rota".
- Remover as mutations agora sem uso: `start`, `finish`, `cancel`, `issueManifest` (e suas server functions associadas se ficarem órfãs).
- Remover imports/ícones sem uso (Play, XCircle, CheckCircle2, FileText, etc.).
- Manter a exibição do card "Borderô" quando já existir borderô emitido (somente leitura).

## Versão e changelog
- `src/config/version.ts`: 1.23.1 → **1.23.2** (MINOR: remoção de funcionalidade local, com aviso explícito).
- `CHANGELOG.md`: entrada em português avisando que os botões "Iniciar rota", "Concluir rota", "Cancelar" e "Emitir borderô" foram removidos da tela de detalhe da rota por não afetarem o ERP; gestão de status passa a ser feita no ERP/Sync.

## Riscos
- Baixo: os botões alteravam somente status local e não integravam com o ERP. Nenhuma migração de banco.

## Checklist para publicar
- Testar no preview: abrir uma rota planejada (ex. 450) e confirmar que só aparece "Excluir rota" (quando vazia); abrir uma rota em andamento e confirmar ausência de "Concluir rota".
- Confirmar que o card "Borderô" continua aparecendo para rotas com borderô já emitido.
- Sem migração SQL. Reversão: restaurar versão anterior no histórico do Lovable.
