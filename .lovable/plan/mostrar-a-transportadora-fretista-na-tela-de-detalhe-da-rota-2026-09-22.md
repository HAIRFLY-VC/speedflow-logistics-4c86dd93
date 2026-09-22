# Mostrar a transportadora/fretista na tela de detalhe da rota

## O problema

Na tela de detalhe (ex.: rota 414) o bloco "Fretista" aparece vazio, com apenas o seletor "Selecione o fretista", e o título mostra só o código `erp-414`.

Motivo confirmado nos dados: a rota 414 tem o responsável vindo do ERP (`driver_name` = "SERGIO RICARDO ALMEIDA WANDERL", nome da rota "M- ARCOMIX"), mas não tem vínculo interno de fretista (`carrier_id` e `erp_carrier_code` vazios). A tela de detalhe só sabe exibir o fretista quando existe esse vínculo interno — diferente da lista Rotas Pendentes, que resolve o responsável pelo ERP (código do responsável da rota, razão social e tipo de frete).

## O que será feito

1. Reaproveitar na tela de detalhe a mesma resolução de responsável usada na lista:
   - buscar o código do responsável da rota no ERP pelo ID da rota;
   - obter razão social e tipo de frete (Fretista / Transportadora / Frota própria) pelo código, com espelho local como reserva;
   - se nada for encontrado, cair para o nome que veio do ERP (`driver_name`).
2. Trocar o título do bloco de "Fretista" para "Responsável pelo frete" e exibir: razão social, código ERP, tipo de frete e placa/telefone quando houver.
3. Manter o seletor de fretista interno, mas abaixo da informação do ERP, apenas para rotas planejadas e usuários com permissão — ele deixa de esconder o dado do ERP.
4. Mostrar o nome da rota no cabeçalho (ex.: "M- ARCOMIX") com o código logo abaixo, como já acontece na lista.

## Detalhes técnicos

- Arquivo principal: `src/routes/_authenticated/rotas.$routeId.tsx`.
- Extrair de `src/components/routes/RotasView.tsx` os utilitários já existentes (`normalizaCod`, `normalizaNome`, `nomeRotaOf`, rótulos de tipo de frete) para um módulo compartilhado (`src/lib/rota-responsavel.ts`), sem mudar o comportamento da lista.
- Reutilizar as funções de servidor já existentes: `listarResponsaveisDeRotasErp`, `listarNaturezasPorCodigoErp`, `listarResponsaveisErp` e o espelho `erp_responsaveis`.
- Falha do ERP não quebra a tela: sem resposta, exibe o nome vindo de `driver_name`.
- Sem mudanças de banco.
