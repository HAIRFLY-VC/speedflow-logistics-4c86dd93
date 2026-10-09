# Plan: mover o card "% Frete do ciclo" para antes de "Pedidos pendentes sem rota"

## O que muda

Na tela **Rotas Pendentes**, a linha de indicadores hoje termina assim:
... → Quantidade de entregas → **Pedidos pendentes sem rota** → **% Frete do ciclo**

Depois da alteração:
... → Quantidade de entregas → **% Frete do ciclo** → **Pedidos pendentes sem rota**

Ou seja, o card rosa de pedidos sem rota passa a ser o último da linha, e o card de percentual de frete vem imediatamente antes dele. Nada mais muda: títulos, valores, cores, o comportamento de clique e os destinos de cada card continuam iguais.

## Como será feito

Os dois cards já são blocos independentes dentro da mesma grade de indicadores em `src/components/routes/RotasView.tsx`. A alteração é apenas inverter a ordem de renderização dos dois blocos, colocando o do percentual de frete antes do bloco de pedidos sem rota.

- A grade continua calculando o número de colunas da mesma forma, então o arranjo visual (6 colunas quando os dois aparecem, menos quando um está oculto) permanece correto.
- As condições que mostram ou escondem cada card (existirem pedidos sem rota; o painel de custo de frete estar ativo) continuam exatamente as mesmas.
- O card de pedidos sem rota mantém o destaque/aviso pulsante e o link para a tela de pedidos sem rota; o card de percentual mantém o link para o painel de custo de frete.

## Detalhes técnicos

- Arquivo: `src/components/routes/RotasView.tsx` — trocar a posição dos dois blocos condicionais dentro do `<div>` da grade de cards, sem alterar o conteúdo interno de nenhum deles.
- Classificação da alteração: **PATCH** — mudança de posição na tela, sem mudança de comportamento.
- Versão: `src/config/version.ts` de `1.32.0` para **1.32.1**, com entrada no `CHANGELOG.md` (### Alterado) informando que o card "% Frete do ciclo" agora aparece antes de "Pedidos pendentes sem rota".
- Banco de dados: nenhuma migração, nenhuma leitura nova, nenhuma escrita. O banco é compartilhado entre teste e oficial, e este ajuste não o toca.
- Feature flags: nenhuma alteração; os cards continuam sob as mesmas condições existentes.
- Integrações (ERP/Bitrix): nenhuma alteração.

## Checklist para publicar

- Abrir a tela de Rotas Pendentes e conferir a nova ordem: ... Quantidade de entregas → % Frete do ciclo → Pedidos pendentes sem rota.
- Clicar nos dois cards e confirmar que continuam levando para o painel de custo de frete e para a tela de pedidos sem rota.
- Reduzir a janela do navegador e conferir que a linha de cards continua se ajustando sem quebrar.
- Nenhuma migração foi aplicada no banco compartilhado e nenhuma flag precisa ser ligada.
- Reversão: voltar à versão 1.32.0 no histórico do Lovable; não há reversão SQL porque nada foi alterado no banco.
