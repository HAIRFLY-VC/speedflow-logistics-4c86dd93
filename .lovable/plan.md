# Endereço completo e praça na NF-e

## Objetivo

Na tela de detalhamento da NF-e, complementar **Dados gerais** com:

- **Endereço completo do destinatário**: logradouro, número, complemento, bairro, município/UF e CEP, usando os dados do XML da própria nota.
- **Praça utilizada**: praça da tabela de preço vinculada ao CT-e que contém a NF-e, seguindo o mesmo critério já usado pela auditoria de frete.

## Implementação

1. Ampliar a leitura do XML da NF-e para retornar o endereço estruturado e formatado do destinatário, sem criar novas colunas no banco.
2. Ao carregar a NF-e, localizar o CT-e associado pela chave da nota e consultar sua auditoria/tabela de preço.
3. Identificar a praça com a mesma regra do cálculo de frete: município aprendido, mapa de municípios, nome da praça ou aproximação usada pela auditoria.
4. Exibir em **Dados gerais**:
   - o endereço em uma linha ampla, permitindo quebra de texto;
   - a praça utilizada e, como contexto, o nome da tabela de preço;
   - `—` ou uma indicação curta quando não houver CT-e associado, tabela vigente ou praça identificável.
5. Se a mesma NF-e estiver associada a mais de um CT-e, priorizar o vínculo com auditoria mais recente e não repetir a praça.
6. Proteger a melhoria com flag ativa em teste e produção, conforme a regra atual do projeto.

## Detalhes técnicos

- Reutilizar a extração de endereço já adotada para CT-e, adaptada ao bloco `enderDest` da NF-e.
- Manter toda consulta complementar na função autenticada que carrega a NF-e, retornando apenas dados simples para a tela.
- Não duplicar a regra de seleção de praça: reaproveitar os utilitários existentes de município e tabela de frete.
- Tratar CT-e complementar e reentrega sem perder o vínculo com a NF-e original.

## Versão e histórico

- Classificação: **MINOR**.
- Versão proposta: **1.41.0**.
- Registrar no changelog que o detalhe da NF-e passa a mostrar o endereço completo do destinatário e a praça usada na tabela de preço.

## Riscos e impacto

- Nenhuma migração ou gravação no banco compartilhado.
- Nenhuma chamada ao ERP ou serviço externo.
- A versão publicada atual não é afetada até a publicação.
- Notas sem XML completo ou sem CT-e/tabela associados continuarão acessíveis, exibindo ausência de informação sem erro.

## Validação

- Conferir a NF-e 65688/1 mostrada no exemplo.
- Testar endereço com e sem complemento, bairro e CEP.
- Conferir uma nota com praça aprendida, outra por mapa e outra sem praça identificada.
- Confirmar que a praça exibida coincide com a auditoria do CT-e associado.
- Validar quebra de texto em computador e tela estreita.

## Checklist para publicar

- Testar manualmente endereço, praça e tabela na prévia.
- Migrações aplicadas: nenhuma.
- Flag: ativa em teste e produção; nenhuma ação adicional após publicar.
- Reversão: retornar à versão 1.40.1 no histórico do Lovable; não há SQL de reversão.
