# Restringir a base de custo de frete às agendas 417 e 427

Classificação: **MINOR** (v1.34.0 → v1.35.0). Muda o comportamento dos demonstrativos, sem quebrar nada existente.

## Objetivo
Somente notas das agendas **417 e 427** devem compor os demonstrativos de custo com frete (card "Mercadorias faturadas", "% Frete do ciclo" e a tela de detalhamento).

## Onde está o problema hoje
- A consulta do ERP que alimenta `speedflow.notas_faturadas` (em `src/lib/erp-sync.server.ts`, ciclo a ciclo) **não filtra agenda** — traz todas.
- A consulta de entregas em aberto (`ENTREGAS_ABERTAS_SQL`, mesma fonte usada como reserva) também não filtra.
- Já existe precedente no app: a sync de pedidos usa `AND E.COD_AGENDA IN (417, 427)`.

## Mudanças

### 1. Sync ERP (`src/lib/erp-sync.server.ts`)
- Adicionar `AND G.COD_AGENDA IN (417, 427)` na consulta de `notas_faturadas` e em `ENTREGAS_ABERTAS_SQL`.
- A limpeza por ciclo (delete das linhas não atualizadas) passa a valer só para agendas 417/427, para não apagar nada indevidamente.

### 2. Leitura (`src/lib/custo-frete.query.ts`)
- Filtro defensivo `cod_agenda in (417,427)` nas duas leituras (custo de frete e mercadorias), garantindo o recorte mesmo com dados antigos na base.

### 3. Limpeza única no banco central (compartilhado com produção)
- Apagar de `speedflow.notas_faturadas` as linhas cuja `cod_agenda` não seja 417/427 (dados já gravados de outras agendas).
- Impacto na versão publicada: os totais de mercadorias/% frete vão diminuir para refletir só as agendas 417 e 427 — que é o comportamento desejado.
- Reversão: rodar o Sync ERP após reverter o código; as notas voltam a ser gravadas.

### 4. Versionamento
- `src/config/version.ts` → 1.35.0 e entrada no `CHANGELOG.md`.

## Checklist para publicar
1. Recarregar o painel e o detalhamento de Mercadorias faturadas: só devem aparecer notas com COD_AGENDA 417 ou 427 (coluna COD_AGENDA visível na tela).
2. Conferir se o total de Valor caiu em relação a antes (notas de outras agendas saíram).
3. Rodar o **Sync ERP** e confirmar que nenhuma nota de outra agenda volta.
4. Não há feature flag para ligar.
5. Reversão: voltar para a v1.34.0 no histórico do Lovable e rodar o Sync ERP.
