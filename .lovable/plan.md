# Corrigir chamada SOAP à SEFAZ no robô de CT-e

## O que o retorno mostra

O certificado A1, o mTLS e a conexão com a SEFAZ **funcionaram** — a requisição chegou ao servidor e ele respondeu. O que voltou foi um erro de protocolo SOAP:

```text
Unable to handle request without a valid action parameter.
Please supply a valid soap action.
```

Causa: o robô envia SOAP 1.2, mas informa a ação no cabeçalho `SOAPAction`, que só existe no SOAP 1.1. No SOAP 1.2 a ação precisa ir dentro do `Content-Type`, como parâmetro `action`. Sem isso a SEFAZ recusa antes de processar o conteúdo.

## Correções em `robo-cte/sefaz.js`

1. **Ação SOAP 1.2**: enviar
   `Content-Type: application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/cte/wsdl/CTeDistribuicaoDFe/cteDistDFeInteresse"` e remover o header `SOAPAction`.
2. **Ambiente ignorado**: `consultar()` usa `this.ambiente`, que nunca é atribuído no construtor — hoje o envelope sempre vai com `tpAmb=1` (produção) mesmo em homologação. Guardar o ambiente no construtor e usá-lo.
3. **Leitura dos documentos retornados**: `NSU` e `schema` vêm como **atributos** de `<docZip NSU="..." schema="...">`, não como elementos filhos. Hoje a extração busca elementos e devolve NSU 0 / schema vazio, o que faz o filtro de CT-e descartar tudo e o NSU não avançar. Passar a ler os atributos e o conteúdo base64 do próprio nó.
4. **Erro SOAP legível**: quando a resposta for um `soap:Fault`, extrair o `faultstring`/`Reason` e registrar apenas essa mensagem, em vez do XML inteiro no log.

## Depois da correção

Rodar novamente no servidor:

```text
node index.js --modo-teste
```

O esperado no log passa a ser `Retorno: cStat=138, maxNSU=..., documentos=N` (ou `cStat=137`, sem documentos novos), em vez do fault SOAP.

## Detalhes técnicos

- `robo-cte/sefaz.js`: header de ação, `this.ambiente`, parser de `docZip` por regex de atributos, detecção de `Fault`.
- Regerar o ZIP de download do robô com as alterações.
