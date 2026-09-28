# Fretistas: listar os fretistas do ERP

## Problema
A tela "Fretistas" lê a tabela local `freight_carriers` (cadastro manual), que hoje tem apenas 1 registro — a transportadora Solution. Os fretistas de verdade vêm do ERP e ficam no espelho `erp_responsaveis` (já sincronizado pelo "Sync ERP"), que a tela ignora.

## O que será feito

Reescrever a tela `src/routes/_authenticated/fretistas.tsx` para listar os fretistas do espelho do ERP:

- **Fonte**: tabela `erp_responsaveis` do banco central, filtrando `tipo_frete = 'F'` (fretistas — natureza EF no ERP).
- **Colunas**: Código ERP, Nome (razão social), PIX cadastrado (apenas "Sim"/"Não" — a chave PIX nunca é exibida, conforme regra já vigente no app).
- **Botão "Atualizar cadastro"**: chama a sincronização de responsáveis do ERP (`sincronizarResponsaveisErp`) para buscar alterações de cadastro (inclusive PIX) e atualiza a listagem — mesmo padrão da tela Transportadoras.
- **Somente leitura**: remover "Novo fretista", edição (lápis) e o interruptor "Ativo" — cadastro e manutenção continuam sendo feitos no ERP.
- Ordenação por nome, com busca/filtros do DataTable já existente.

## Detalhes técnicos
- Arquivo alterado: `src/routes/_authenticated/fretistas.tsx` (reescrita da query e das colunas; remoção do formulário de cadastro/edição).
- Reutiliza: `supabase` de `@/integrations/central/client`, `sincronizarResponsaveisErp` de `@/lib/rota-erp.functions.ts`, `DataTable`.
- Nenhuma alteração de banco de dados, permissões ou em outras telas. A tabela local `freight_carriers` permanece intacta (usada em outros pontos, ex.: vínculo de rotas).
- Validação: typecheck + conferência visual da listagem no navegador.
