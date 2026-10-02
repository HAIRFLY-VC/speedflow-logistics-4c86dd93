# Lembrar a configuração de impressão no perfil do usuário (v1.18.0 — MINOR)

## O que muda
- Hoje a última configuração de impressão (papel, orientação, fonte, modo econômico, seções e ordenação) fica guardada só no navegador. Ela se perde ao trocar de computador ou de navegador.
- Passa a ser salva no perfil do usuário. Ao abrir a impressão em qualquer computador, o app já sugere a configuração usada da última vez.
- Enquanto o perfil é consultado, usa a cópia do navegador (se houver) para a tela abrir na hora; depois aplica a do perfil.

## Detalhes técnicos
- Reaproveitar a tabela de preferências por usuário já existente (`user_table_preferences`, chave `print:rota`), que já tem RLS por usuário. Sem migração.
- `src/components/print/usePrintPrefs.ts`: ler com `getTablePrefs` (ou função equivalente em `ui-prefs.functions.ts`) e salvar com `saveTablePrefs`, com espera de ~600 ms para agrupar cliques seguidos; manter localStorage como cache.
- Funciona para qualquer impressão futura do módulo, pois a chave é por documento.
- `version.ts` 1.18.0 e `CHANGELOG.md`.

## Riscos
- Banco compartilhado: só grava linhas novas de preferência do próprio usuário; nada é alterado na estrutura.

## Verificação
- No preview, mudar opções, recarregar a página e confirmar que a configuração volta; conferir a linha gravada no banco.
