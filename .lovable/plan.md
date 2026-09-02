# Cadastro local de responsáveis do ERP (fretista / transportadora / frota própria)

## Objetivo

Guardar no banco central um espelho dos responsáveis do ERP (código, razão social, natureza)
para que o app sempre saiba o nome e o código de quem está na rota — inclusive quando não existe
transportadora cadastrada localmente, como no caso da ID 368 (VITOR ALEXANDRE BARROS DE SOUZ).

Com esse cadastro:
- "Fret / Transp" passa a mostrar sempre `NOME (CÓDIGO)`;
- o selo "Tipo" (F / T / P) deixa de depender de consulta ao ERP a cada abertura da tela;
- a tela carrega mais rápido, pois lê do banco e só consulta o ERP quando falta alguém.

## Como vai funcionar

1. **Nova tabela `erp_responsaveis`** no banco central: código no ERP (chave), razão social,
   natureza bruta (EF/ET/EM/outras), tipo derivado (F/T/P), data da última sincronização.
2. **Sincronização completa**: uma ação que lê a lista de responsáveis no ERP e grava/atualiza
   todos os registros na tabela. Ela roda:
   - ao clicar em **"Atualizar cadastro"** na tela de Transportadoras (botão novo, com aviso de
     quantos registros foram atualizados);
   - automaticamente junto do Sync ERP.
3. **Atualização sob demanda (auto)**: ao abrir a lista de Rotas, o app compara os códigos de
   responsável das rotas com o cadastro local. Se algum código não estiver lá, dispara uma
   sincronização apenas desses códigos (consulta pontual no ERP) e grava o resultado —
   sem o usuário precisar fazer nada. Isso roda no máximo uma vez por conjunto de códigos faltantes.
4. **Exibição**: nome e código vêm, nesta ordem, do cadastro local → do que já veio do ERP na
   sessão → da transportadora cadastrada localmente. Sem nenhum deles, mostra só o nome (como hoje).

## Detalhes técnicos

- Novo script `db/central/2026-09-02_erp_responsaveis.sql`:
  `create table if not exists speedflow.erp_responsaveis (cod_erp text primary key, razao_social text,
  natureza text, tipo_frete text, atualizado_em timestamptz not null default now())`, com índice por
  `razao_social` e comentários. Aplicado no banco central pelo mesmo caminho REST usado nos demais scripts.
- `src/lib/rota-erp.functions.ts`:
  - `sincronizarResponsaveisErp()` — server fn que roda a consulta completa (`a_cadctipo`, sem filtro de
    natureza restrito) e faz upsert em lote em `erp_responsaveis`, devolvendo `{ total, atualizados }`;
  - `sincronizarResponsaveisPorCodigo({ cods })` — reutiliza `listarNaturezasPorCodigoErp` e persiste o
    resultado no cadastro local;
  - as duas funções continuam usando `requireSupabaseAuth`.
- `src/lib/central-db.ts` / `src/integrations/central/types.ts`: tipagem da nova tabela.
- `src/routes/_authenticated/rotas.index.tsx`:
  - nova query `["erp-responsaveis"]` lendo a tabela local (staleTime alto);
  - efeito que detecta códigos ausentes em `codResponsavelPorRota` e chama
    `sincronizarResponsaveisPorCodigo`, invalidando a query ao terminar;
  - `motoristaOf` passa a receber `{ nome, cod }` resolvidos pelo cadastro local, com os fallbacks atuais;
  - `tipoFreteOf` lê primeiro o cadastro local.
- `src/routes/_authenticated/transportadoras.tsx`: botão "Atualizar cadastro do ERP" chamando
  `sincronizarResponsaveisErp`, com toast de resultado.
- `src/lib/erp-sync.server.ts`: a rotina de Sync ERP passa a atualizar também `erp_responsaveis`.
