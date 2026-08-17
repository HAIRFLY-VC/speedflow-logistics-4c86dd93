# Pacote do robô sempre em uma única pasta

## Problema confirmado

O arquivo `robo-cte-atualizacao.zip` atual tem 19 entradas: uma pasta `robo-cte/` com a versão antiga (15/08) e, no nível raiz, os mesmos 9 arquivos da versão nova (17/08). Isso aconteceu porque o novo pacote foi gravado por cima do zip existente, em vez de substituí-lo — o zip antigo não foi apagado antes.

## O que fazer

1. Gerar um pacote novo e limpo, sempre com esta estrutura:

```text
robo-cte-atualizacao-v2.zip
└── robo-cte/
    ├── README.md
    ├── config.exemplo.json
    ├── index.js
    ├── instalar-windows.ps1
    ├── install-service.cjs
    ├── package.json
    ├── robo-cte.service
    ├── sefaz.js
    └── uninstall-service.cjs
```

2. Conferir a listagem do zip antes de entregar: só pode existir uma pasta raiz `robo-cte/` e nenhum arquivo solto.
3. Entregar como novo arquivo versionado (`robo-cte-atualizacao-v2.zip`), mantendo o antigo intacto.

## Regra permanente

Registrar como preferência do projeto: todo pacote de download do robô é montado do zero (apagando qualquer zip anterior de mesmo nome ou usando nome versionado) e contém **uma única pasta raiz** `robo-cte/` com todos os arquivos dentro dela — nunca arquivos soltos na raiz do zip.
