# Robô de importação de CT-e — SpeedFlow Logistics

Este robô roda no **seu servidor** e consulta a SEFAZ usando o certificado digital A1 (mTLS), captura os XMLs de CT-e via Distribuição DFe e os envia para o endpoint de ingestão do SpeedFlow Logistics.

> ⚠️ O certificado A1 não pode ficar dentro do aplicativo. O backend do app roda em ambiente serverless sem suporte a conexão mTLS com a SEFAZ. Por isso, o robô precisa rodar na sua infraestrutura.

## Pré-requisitos

- Servidor com Windows Server ou Linux (Ubuntu/Debian/CentOS recomendado).
- Node.js 18+ instalado.
- Certificado A1 válido no formato `.pfx` para cada CNPJ que consultará a SEFAZ.
- Segredo de ingestão `CTE_INGEST_SECRET` configurado no app (tela **Captura de CT-e**).
- CNPJs das empresas e transportadoras/destinatários cadastrados no app.

## Instalação rápida

### 1. Copie a pasta do robô para o servidor

```bash
cp -r robo-cte /opt/robo-cte
cd /opt/robo-cte
npm install  # não há dependências externas, mas cria a pasta node_modules vazia
```

### 2. Configure o `config.json`

```bash
cp config.exemplo.json config.json
nano config.json
```

- Cole o segredo de ingestão no campo `segredoIngest`.
- Ajuste a URL do `endpoint` (use a URL de produção publicada do app).
- Configure `ufAutor` com o código IBGE da UF do contribuinte (ex: 35 para SP, 31 para MG).
- Adicione uma entrada em `empresas` para cada CNPJ/certificado.
- Mantenha `ambiente: "homologacao"` para testar. Depois, mude para `"producao"`.

> ⚠️ **Windows:** em `caminhoCertificado`, use barra normal (`"C:/certs/certificado.pfx"`) ou barra invertida dupla (`"C:\\certs\\certificado.pfx"`). Uma barra invertida simples quebra o JSON e o robô aborta com `Bad escaped character in JSON`.



### 3. Teste manualmente

```bash
node index.js --modo-teste
```

Se aparecer a mensagem de conexão bem-sucedida e nenhum CT-e for encontrado, o robô está funcionando.

### 4. Instale como serviço (Linux — systemd)

```bash
sudo cp robo-cte.service /etc/systemd/system/robo-cte.service
sudo systemctl daemon-reload
sudo systemctl enable robo-cte
sudo systemctl start robo-cte
sudo systemctl status robo-cte
```

Ajuste no arquivo de serviço o caminho da pasta e o usuário que executará o processo.

### 5. Instale como serviço (Windows)

Como administrador, instale o `node-windows` **na própria pasta do robô** (instalação global não é resolvida pelo `require`) e execute o script `.cjs`:

```powershell
cd C:\Services\robo-cte
npm install node-windows
node install-service.cjs
```

> O script é `.cjs` (CommonJS) porque o `package.json` deste projeto usa `"type": "module"`. Arquivos `.js` seriam interpretados como ES Modules e falhariam com `require is not defined`.


Para remover o serviço:

```powershell
node uninstall-service.cjs
```

### 6. Acompanhe os recebimentos

No app, vá em **Captura de CT-e** e confira o histórico de recebimentos com origem **Automático**.

## Funcionamento

1. O robô lê o último NSU processado para cada empresa (armazenado em `config.json` ou em arquivo separado).
2. Consulta o webservice `CTeDistribuicaoDFe` da SEFAZ com mTLS usando o certificado A1.
3. Recebe um lote comprimido (gZip + Base64) e extrai os documentos.
4. Filtra apenas os CT-e (`procCTe`) e envia um XML por requisição para o endpoint do app.
5. Atualiza o último NSU processado e aguarda o intervalo configurado.

## Arquivos

- `index.js` — loop principal e orquestração.
- `sefaz.js` — cliente SOAP da SEFAZ com mTLS.
- `config.json` — configuração do robô (criado a partir do exemplo).
- `robo-cte.service` — unidade systemd.
- `instalar-windows.ps1` — script de instalação do serviço no Windows.
- `logs/robo-cte.log` — log de execução.

## Segurança

- O certificado A1 nunca é enviado ao app; ele fica apenas no servidor do robô.
- O segredo de ingestão é enviado apenas no cabeçalho `x-ingest-secret` das requisições.
- Recomenda-se restringir o acesso à pasta do robô e ao arquivo `config.json`.

## Solução de problemas

| Sintoma | Causa provável | Solução |
|---|---|---|
| `Unauthorized` no envio | Segredo incorreto | Verifique `segredoIngest` no `config.json` |
| `UNIQUE constraint` / duplicado | XML já enviado | Normal; o robô pode reenviar sem problemas |
| `Bad escaped character in JSON` | Caminho do Windows com `\` simples no `config.json` | Use `C:/...` ou `C:\\...` |
| `ERRO DE CONFIGURACAO: ... incompleta` | Campos obrigatórios em branco | Preencha os campos listados na mensagem |
| `PENDENTE_IDENTIFICACAO` | CNPJ não cadastrado | Cadastre a transportadora e empresa no app |
| Erro de certificado | Certificado A1 expirado ou senha incorreta | Renove e atualize o `.pfx` e a senha |
| Nenhum CT-e retornado | NSU já está atualizado | Aguarde novos CT-e serem autorizados na SEFAZ |

## Suporte

Para dúvidas sobre a configuração no app, use a tela **Captura de CT-e > Instalação do robô**.

## Leitura automática de NF-e (XML das notas do CT-e)

Quando um usuário clica em uma chave de NF-e no detalhamento do CT-e, o aplicativo
registra a solicitação numa fila. O robô, que possui o certificado A1, faz:

1. `GET /api/public/hooks/nfe-pendentes` — lista as chaves solicitadas;
2. consulta o webservice `NFeDistribuicaoDFe` da SEFAZ por chave (`consChNFe`);
3. `POST /api/public/hooks/ingest-nfe` — envia o XML (ou o erro) de volta.

A verificação acontece a cada ciclo e também durante a espera, no intervalo definido
em `intervaloNfeSegundos` (padrão: 60 segundos).

O robô envia um sinal de vida ao aplicativo a cada 60 segundos, mesmo durante
leituras longas na SEFAZ, e aborta consultas travadas: `timeoutConsultaSegundos`
(padrão 120s por consulta) e `timeoutCicloMinutos` (padrão 15min por ciclo).
Assim a tela de CT-e mostra "Robô ativo" ou "Robô offline" antes de você pedir
uma importação forçada.


Observação: a SEFAZ só devolve o XML completo da NF-e quando o CNPJ consultante é o
destinatário e a operação está manifestada. Caso contrário, o app mostra o motivo e
permite importar o XML manualmente.
