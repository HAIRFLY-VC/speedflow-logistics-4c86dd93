# Robô de importação de CT-e: pacote pronto + guia de instalação

Hoje o app já recebe CT-e pelo endpoint público, mas o robô que fala com a SEFAZ usando o certificado A1 não existe — ele precisa rodar na sua infraestrutura, porque só lá é possível a conexão com certificado (mTLS) que a SEFAZ exige.

Esta entrega cria o robô pronto para instalar e um guia passo a passo dentro do app.

## 1. Pacote do robô (nova pasta `robo-cte/` no projeto)

Um serviço Node.js pequeno, sem interface, que roda no seu servidor:

- Lê o certificado A1 (`.pfx`) e a senha de um arquivo de configuração.
- Consulta o serviço de Distribuição DFe da SEFAZ (`distDFeInt`) por CNPJ, usando NSU incremental.
- Descompacta os documentos (gZip), filtra os CT-e (`procCTe`) e ignora eventos e resumos.
- Envia cada XML para `POST /api/public/hooks/ingest-cte` com o cabeçalho `x-ingest-secret`.
- Grava o último NSU processado em arquivo local, para não reprocessar.
- Repete em intervalo configurável (padrão 30 min), com retentativa e log em arquivo.
- Suporta várias empresas/CNPJs, cada uma com seu certificado.

Arquivos: `robo-cte/index.js` (loop principal), `robo-cte/sefaz.js` (SOAP + mTLS + gZip), `robo-cte/config.exemplo.json`, `robo-cte/README.md`, `robo-cte/robo-cte.service` (systemd, Linux) e `robo-cte/instalar-windows.ps1` (registro como serviço via NSSM).

## 2. Guia de instalação dentro do app

Nova aba "Instalação do robô" na tela **Captura de CT-e**, com:

- Pré-requisitos (servidor Windows ou Linux, Node.js 20, certificado A1 `.pfx` válido).
- Passos numerados: baixar a pasta do robô, criar o `config.json`, testar em modo manual, instalar como serviço, verificar o painel de recebimentos.
- Blocos de comando prontos para copiar, para Linux (systemd) e Windows (serviço).
- O `config.json` já preenchido com a URL do endpoint deste projeto e um campo para colar o segredo de ingestão.
- Checklist de verificação: o robô aparece no histórico de recebimentos com origem SEFAZ_AUTO.

## 3. Ambiente de homologação

O `config.json` terá `ambiente: "producao" | "homologacao"` para você testar antes de valer.

## Detalhes técnicos

- SEFAZ: `CTeDistribuicaoDFe` (Ambiente Nacional), operação `distDFeInt` por `distNSU`, resposta em `docZip` base64+gzip.
- mTLS com `https.Agent({ pfx, passphrase })` — por isso o robô roda fora do app.
- Envio: `Content-Type: application/xml`, corpo com o XML completo do `procCTe`.
- Nada do certificado trafega ou é armazenado no app.

## Fora do escopo

- Manifestação do destinatário (ciência da operação).
- Interface gráfica do robô; a operação é por arquivo de configuração e logs.
