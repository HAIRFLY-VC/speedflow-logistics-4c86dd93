# Corrigir erro "Bad escaped character in JSON" no robô de CT-e

## O que está acontecendo

O robô iniciou normalmente, mas ao ler o `config.json` o Node não conseguiu interpretar o arquivo:

```text
Erro no ciclo: Bad escaped character in JSON at position 436 (line 13 column 33)
```

A linha 13 do `config.json` é a do certificado:

```text
"caminhoCertificado": "C:\certs\certificado.pfx"
```

Em JSON a barra invertida `\` é caractere de escape. `\c` não é um escape válido, então o arquivo inteiro falha ao ser lido — antes mesmo de qualquer contato com a SEFAZ.

## Correção imediata (no seu servidor, sem mudar código)

No `config.json`, escreva o caminho de uma destas duas formas:

```text
"caminhoCertificado": "C:/certs/certificado.pfx"
```
ou
```text
"caminhoCertificado": "C:\\certs\\certificado.pfx"
```

Depois rode de novo: `node index.js --modo-teste`

## Melhorias no robô (para não repetir o problema)

1. **Mensagem de erro clara**: ao falhar o parse do `config.json`, o robô passa a informar o arquivo, a linha e a dica específica ("verifique barras invertidas em caminhos do Windows — use `/` ou `\\`"), em vez do erro cru do Node.
2. **Validação de configuração na inicialização**: antes do primeiro ciclo, checar campos obrigatórios (`endpoint`, `segredoIngest`, `empresas[].cnpj`, `ufAutor`, `caminhoCertificado`, `senhaCertificado`) e abortar com lista do que está faltando.
3. **Erro de config não entra em loop**: hoje um `config.json` inválido em modo serviço ficaria repetindo o ciclo; passará a encerrar com código de saída 1.
4. **Exemplo e guia**: acrescentar em `robo-cte/config.exemplo.json` (comentário no README) e no guia da tela **Captura de CT-e** uma nota sobre caminhos no Windows.

## Detalhes técnicos

- `robo-cte/index.js`: envolver `JSON.parse` em `readConfig()` com try/catch traduzindo a mensagem; adicionar `validarConfig(cfg)` chamada em `run()`; tratar erro de configuração como fatal.
- `robo-cte/README.md` e `src/routes/_authenticated/captura-cte.tsx`: nota sobre escapar o caminho do certificado.
- Regerar o ZIP de download do robô com as alterações.
