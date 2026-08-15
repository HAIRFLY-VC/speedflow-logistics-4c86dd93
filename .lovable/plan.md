# Corrigir "Robô não respondeu" ao forçar importação de CT-e

## Causa confirmada

O robô no servidor está ativo — o problema está no aplicativo publicado.

A rota que o robô consulta para saber se há uma importação forçada
(`/api/public/hooks/cte-comandos`) **não existe no site publicado**: ela responde
404 no endereço de produção, enquanto as outras rotas do robô respondem
normalmente (`ingest-cte` = 401 sem segredo, `nfe-pendentes` = 200).

Confirmação no banco: nos 8 pedidos de importação já criados (13/08 a 15/08),
o campo `iniciado_em` está vazio em **todos**. Ou seja, o robô nunca conseguiu
assumir nenhum comando — ele recebe 404, registra o erro no log local e segue.
Passados 3 minutos, o aplicativo expira o pedido e mostra a mensagem de falha.

## Correção

1. **Publicar o aplicativo.** A rota de fila de comandos já existe no código, só
   não foi ao ar na última publicação. Publicar resolve o 404 e o robô passa a
   receber os pedidos no próximo ciclo de verificação (a cada 60s por padrão).
2. **Verificar depois de publicar** que a rota responde 401 (e não 404) sem o
   segredo, igual às demais rotas do robô.

## Melhorias para não repetir o diagnóstico às cegas

3. **Heartbeat do robô**: registrar a cada consulta do robô (na rota
   `cte-comandos`, e também em `nfe-pendentes`) a data/hora do último contato.
4. **Mensagem de erro útil**: quando o pedido expirar, a tela passa a informar
   quando foi o último contato do robô — distinguindo "robô parado/desatualizado"
   de "aplicativo desatualizado/rota indisponível", em vez da mensagem genérica
   atual.
5. **Prazo de expiração**: aumentar o limite de `PENDENTE` de 3 para 5 minutos,
   já que o robô pode estar no meio de um ciclo longo de leitura na SEFAZ e só
   consultar a fila ao terminar.

## Detalhes técnicos

- Nova tabela `robo_heartbeats` (ou coluna em `configuracoes_auditoria_frete`)
  gravada via `supabaseAdmin` nas rotas `src/routes/api/public/hooks/cte-comandos.ts`
  e `nfe-pendentes.ts`, com `ultimo_contato` e a origem da chamada.
- `src/lib/cte-captura.functions.ts`: `LIMITE_PENDENTE_MS` para 5 min; nova server
  fn `getStatusRobo` retornando o último contato; mensagem de expiração incluindo
  esse dado.
- `src/routes/_authenticated/ctes.tsx`: exibir "último contato do robô: há X min"
  junto ao botão de forçar importação.
- Nenhuma alteração necessária no pacote do robô instalado no servidor.
