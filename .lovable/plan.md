# Plano: Tornar executável a rotação do CTE_INGEST_SECRET

## Contexto atual

A tela **Captura de CT-e** (`/captura-cte`) instrui o usuário a executar o passo:

> "gere um token forte no servidor (ex: `openssl rand -hex 32`) e salve-o no projeto em **Config. de fretes** → **Rotacionar segredo de ingestão**. Depois cole o mesmo valor no `config.json` do robô."

Porém, a tela **Configurações de fretes** (`/configuracoes-fretes`) não possui hoje um botão ou seção de rotação do segredo `CTE_INGEST_SECRET`. Isso torna o passo descritivo, mas não executável dentro do app.

## Objetivo

Disponibilizar na tela **Configurações de fretes** uma ação clara que permita ao administrador atualizar o valor de `CTE_INGEST_SECRET`, com instruções paralelas sobre como gerar o valor no servidor do robô e onde colá-lo no `config.json`.

## Escopo

### 1. Adicionar card de segredo de ingestão em `/configuracoes-fretes`

Criar um novo card na tela de configurações de fretes com:

- Título "Captura automática de CT-e".
- Indicador visual de status: segredo configurado ou não configurado.
- Botão primário "Rotacionar segredo de ingestão".
- Texto explicativo:
  - O que é o segredo (autenticação do robô externo no endpoint `/api/public/hooks/ingest-cte`).
  - Como gerar um valor forte no servidor do robô (`openssl rand -hex 32`).
  - Onde colar o mesmo valor no `config.json` (`segredoIngest`).
  - Aviso de que o valor não será exibido novamente após salvo.

### 2. Expor status do segredo via backend

- Criar ou reaproveitar server function em `src/lib/configuracoes-fretes.functions.ts` que retorne apenas `segredoConfigurado: boolean` para a tela de configurações (sem expor o valor).
- Garantir que a verificação continue usando `process.env["CTE_INGEST_SECRET"]`.

### 3. Integrar rotação com o formulário seguro de secrets

- Ao clicar em "Rotacionar segredo de ingestão", disparar o fluxo `secrets--update_secret` (ou `add_secret` quando ausente) para o nome `CTE_INGEST_SECRET`.
- O formulário seguro abre para o usuário digitar o novo valor; o valor nunca trafega pela conversa.
- Após salvamento, invalidar o cache da query de status para refletir o novo estado.

### 4. Ajustar instruções em `/captura-cte`

- Manter o texto da aba "Instalação do robô".
- Garantir que a frase "Config. de fretes → Rotacionar segredo de ingestão" reflita a ação real implementada no passo 1.
- Adicionar nota de que o valor gerado no servidor do robô deve ser idêntico ao valor salvo no app.

### 5. Validação e segurança

- Não expor o valor atual do segredo em nenhuma API ou log.
- Limitar a ação ao perfil `adm` (a tela já requer `adm`).
- Confirmar que o endpoint `/api/public/hooks/ingest-cte` continua validando o segredo com comparação constante (`safeEqual`).

## Resultado esperado

O usuário poderá seguir, na íntegra, a instrução apresentada na tela de Captura de CT-e:

1. Abrir **Configurações de fretes**.
2. Clicar em **Rotacionar segredo de ingestão**.
3. Informar o valor gerado no servidor (`openssl rand -hex 32`).
4. Colar o mesmo valor no `config.json` do robô.
5. Ver o status atualizado na tela de configurações e na checklist de verificação de `/captura-cte`.

## Fora de escopo

- Alterar o funcionamento do robô `robo-cte/` (apenas documentação/instruções).
- Alterar o endpoint `/api/public/hooks/ingest-cte` (já valida corretamente).
- Implementar geração automática de segredo pelo app (o valor continua sendo gerado no servidor do usuário).
