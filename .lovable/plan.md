# Rotação do CTE_INGEST_SECRET

## Contexto
O `CTE_INGEST_SECRET` é a secret que autentica o robô de importação de CT-e no endpoint `/api/public/hooks/ingest-cte`. Ele já está configurado no backend, mas **não é exibido no app e não pode ser revelado** por segurança.

## Como obter um valor utilizável
A ferramenta `generate_secret` cria um valor aleatório, mas **nunca o revela** — portanto não serve para colar no `config.json` do robô. Como esse segredo é compartilhado entre o app e o robô externo, você precisa informar um valor forte e salvá-lo em ambos os lugares.

## Plano
1. Instruir você a gerar um valor forte localmente (ex: `openssl rand -hex 32`).
2. Abrir o formulário seguro via `add_secret` para que você salve o mesmo valor como `CTE_INGEST_SECRET` no projeto.
3. Atualizar a aba **Instalação do robô** em `/captura-cte` para explicar que o valor deve ser colado no `config.json` do servidor, já que ele não é mostrado no app.

## Resultado esperado
Você terá um novo `CTE_INGEST_SECRET` válido e instruções claras de onde colá-lo no robô.
