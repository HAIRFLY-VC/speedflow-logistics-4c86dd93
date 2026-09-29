# Destacar totalizadores e exibir a data completa

## Classificação

**PATCH — v1.9.1.** Correção visual na listagem de Rotas Pendentes.

## O que será alterado

- Trocar o fundo das linhas totalizadoras por um destaque próprio, mais evidente e visualmente diferente do cinza usado quando o mouse passa sobre uma rota.
- Usar uma tonalidade suave baseada na cor principal do sistema, mantendo contraste adequado nos temas claro e escuro.
- Exibir a seta de expandir/comprimir na coluna **ID** e mover a data do totalizador para a coluna **Data planejada**.
- Garantir que a data apareça completa no formato `DD/MM/AAAA`, sem corte.
- Manter os totais alinhados às respectivas colunas e preservar a abertura automática e o controle de expandir/comprimir.

## Detalhes técnicos

- Ajustar a linha de grupo no componente compartilhado para posicionar o rótulo na coluna usada pelo agrupamento, em vez de forçá-lo na primeira coluna visível.
- Aplicar classes semânticas distintas para fundo, bordas e interação da linha totalizadora.
- Manter o comportamento padrão das outras tabelas agrupadas; o novo posicionamento acompanha a coluna que originou cada agrupamento.

## Riscos e impacto

- **Banco compartilhado:** nenhum; sem migração ou alteração de dados.
- **Integrações:** nenhuma alteração.
- **Feature flags:** nenhuma.
- O ajuste é somente visual e mantém as ações existentes.

## Validação

- Conferir que cada linha totalizadora tem fundo claramente diferente do destaque ao passar o mouse nas rotas.
- Confirmar que todas as datas aparecem completas.
- Verificar alinhamento dos totais, expansão e compressão no computador.
- Conferir que os cartões no celular continuam legíveis e funcionais.

## Checklist para publicar

- Testar no preview em computador e celular.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: retornar à versão 1.9.0 pelo histórico do Lovable; não há SQL de reversão.
