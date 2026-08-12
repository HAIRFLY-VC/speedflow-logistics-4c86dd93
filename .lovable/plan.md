# Captura automática de CT-e com certificado A1

## Onde o certificado fica

O certificado A1 **não fica dentro do aplicativo**. O backend roda em ambiente serverless de borda, que não permite abrir conexão TLS mútua (mTLS) com o webservice de Distribuição DFe da SEFAZ — que é exatamente o que o A1 exige.

O A1 fica no seu robô/serviço, rodando na sua infraestrutura (Windows ou Linux, .NET/Java/Node/Python). Ele consulta a SEFAZ por CNPJ e envia cada XML de CT-e para o aplicativo pelo endpoint de ingestão que já existe.

```text
[ Certificado A1 por empresa ]
            |
   Robô (sua infra) --- consulta DistDFe SEFAZ por CNPJ
            |
            v  POST XML + segredo
  App: /api/public/hooks/ingest-cte  -->  parse -> bucket cte-xml -> auditoria
```

## O que será construído no app

### 1. Tela "Captura de CT-e" (dentro de Config. de fretes)
- Instruções prontas com a URL do endpoint, método, cabeçalho de autenticação e formato do corpo (XML puro ou JSON `{ "xml": "..." }`).
- Botão para copiar a URL e um botão "Testar envio" que valida o segredo com um XML de exemplo.
- Painel de status: último CT-e recebido por origem (MANUAL / SEFAZ_AUTO), quantidade nas últimas 24h e 7 dias, e erros recentes.

### 2. Registro de recebimentos
- Nova tabela de log de ingestão gravando: data/hora, CNPJ do emitente e do destinatário, chave de acesso, resultado (criado / duplicado / erro) e mensagem.
- O endpoint passa a gravar nesse log em todos os caminhos, inclusive falha de parse e chave duplicada.

### 3. Vínculo por empresa
- O endpoint já identifica a transportadora pelo CNPJ do emitente; passará também a vincular a `empresas` pelo CNPJ do destinatário, para que cada empresa do grupo caia no lugar certo sem configuração extra no robô.
- Empresa não cadastrada: o CT-e entra com status `PENDENTE_IDENTIFICACAO` e aparece destacado na tela de captura.

### 4. Guia do robô
- Página com o passo a passo do que o robô deve fazer: consulta `distDFeInt` por NSU incremental, descompactar o gZip, filtrar `procCTe`, e postar no endpoint. Inclui exemplo de requisição em cURL e o controle do último NSU processado.

## Detalhes técnicos
- Endpoint existente: `POST /api/public/hooks/ingest-cte`, cabeçalho `x-ingest-secret` (segredo `CTE_INGEST_SECRET` já configurado). URL estável: `project--0f575c65-0542-477f-8d03-b4c26e47b952.lovable.app/api/public/hooks/ingest-cte`.
- Migração: tabela `cte_ingest_logs` com GRANTs, RLS de leitura para staff e escrita apenas por service_role.
- Alterações em `src/lib/cte-ingest.server.ts` (log + vínculo com `empresas`) e em `src/routes/api/public/hooks/ingest-cte.ts` (registro de falhas).
- Nova aba/seção em `src/routes/_authenticated/configuracoes-fretes.tsx` mais server functions em `src/lib/configuracoes-fretes.functions.ts`.

## Fora do escopo
- Assinar, consultar ou armazenar o certificado A1 dentro do app.
- Distribuição de manifestação de destinatário (evento de ciência da operação) — pode ser adicionada depois no robô.
