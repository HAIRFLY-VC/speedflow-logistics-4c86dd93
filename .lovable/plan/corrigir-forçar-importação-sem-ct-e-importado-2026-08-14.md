# Corrigir "Forçar importação" sem CT-e importado

## O que os dados mostram

- O robô **está** enviando XMLs: 396 recebimentos nas últimas 2 horas (últimos às 11:14).
- **Todos** foram descartados com o motivo "remetente ... não é uma empresa cadastrada", inclusive os do CNPJ 10627976000142 (o detentor do certificado A1).
- Motivo: a tabela de **empresas** do app está vazia — nenhuma empresa cadastrada, então a regra "só importar CT-e cujo remetente seja empresa cadastrada" rejeita tudo.
- Além disso, os três comandos de "Forçar importação" (13/08 23:25, 14/08 10:35 e 11:05) nunca foram assumidos pelo robô (nenhum início registrado) e expiraram com "Robô não respondeu". Ou seja, o robô no servidor ainda é uma versão que não consulta a fila de comandos — ele só roda pelo intervalo automático.

## Correções propostas

1. **Cadastrar a empresa detentora do certificado** (CNPJ 10627976000142) na tela de Empresas, para que os CT-es em que ela é remetente passem a ser importados. Preciso saber a razão social; se houver mais de um CNPJ próprio, cadastrar todos.
2. **Reprocessar o histórico**: após o cadastro, disparar a reimportação total (o robô varre a SEFAZ desde o primeiro NSU) para recuperar os 396 documentos descartados.
3. **Melhorar o diagnóstico na tela de Captura de CT-e**: exibir um aviso destacado quando houver recebimentos descartados por remetente não cadastrado, listando os CNPJs mais frequentes com um botão para cadastrar a empresa direto dali. Assim o problema fica visível em vez de "nada importado".
4. **Alerta quando não há nenhuma empresa cadastrada**: bloquear/avisar no botão de importação, explicando que sem empresa cadastrada nenhum CT-e será aceito.
5. **Robô desatualizado**: o pacote v4 (com suporte à fila de comandos) precisa ser instalado no servidor e o serviço reiniciado; sem isso o botão continuará expirando, mesmo com a importação automática funcionando.

## Detalhes técnicos

- `src/lib/cte-ingest.server.ts`: mantém a regra de remetente, apenas o cadastro de `empresas` resolve o descarte.
- `src/lib/cte-captura.functions.ts`: nova server fn que agrega `cte_ingest_logs` com `resultado = 'IGNORADO'` por CNPJ remetente (extraído da mensagem ou de coluna dedicada) nas últimas 24h.
- `src/routes/_authenticated/captura-cte.tsx` e `ctes.tsx`: painel de CNPJs descartados + ação rápida de cadastro em `empresas`.
