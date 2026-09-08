# Painel "Entregas em aberto" em formato de planilha + card de pendências

## Contexto
A tela **Entregas em aberto** (`/entregas-abertas`) hoje mostra cartões em lista. O usuário quer a mesma estrutura de dados da aba **ABERTOS** da planilha modelo, exibida como tabela de planilha (linhas e colunas), e um card de destaque com a quantidade de entregas pendentes.

## O que será feito

### 1. Card de resumo no topo
Card em destaque acima da tabela com a **quantidade de entregas pendentes** (linhas atualmente filtradas), acompanhado dos totais já existentes (valor e peso) para dar contexto.

### 2. Tabela estilo planilha com as colunas da aba ABERTOS
Substituir a lista de cartões por uma tabela com rolagem horizontal, cabeçalho fixo e linhas compactas, com as colunas do modelo:

| Coluna | Origem |
|---|---|
| NF | `nro_nf` |
| Pedido | `cod_pedido` |
| Cliente | código + razão social (`clientes_erp`) |
| UF | cadastro do cliente |
| Cidade | cadastro do cliente |
| RCA | nome do vendedor (`erp_responsaveis`) |
| Transportadora | nome (`erp_responsaveis`) |
| Modal | Fretista / Transportadora / Próprio |
| Dt. pedido | `dt_pedido` |
| Dt. faturamento | `dt_fatur` |
| Dt. saída | `dt_saida` |
| Dias | dias desde a saída |
| Faixa | 0-2 / 3-5 / 6-10 / +10 dias |
| Valor (R$) | `valor` |
| Peso (kg) | `peso` |
| Agendada | `entrega_agend` |
| Ação / Responsável / Prazo | anotação do app + botão de editar (abre o mesmo painel lateral) |

- Linhas com mais de 10 dias em aberto destacadas (vermelho suave), como hoje no badge.
- Busca e os filtros de múltipla seleção (estado, cidade, transportadora, RCA, modal, idade, filial) continuam funcionando sobre a tabela.
- Rodapé fixo mantém: X notas · Y entregas · kg · R$.
- O painel lateral de edição de **Ação / responsável / prazo** permanece igual, aberto pelo botão na linha.
- No celular a tabela rola horizontalmente, preservando a estrutura de planilha.

## Arquivo envolvido
- `src/routes/_authenticated/entregas-abertas.tsx` (único arquivo alterado).

## Critério de aceite
- A tela exibe as entregas em grade de tabela, uma linha por NF, com as colunas da aba ABERTOS.
- Card no topo mostra a quantidade de entregas pendentes (recalculado pelos filtros).
- Filtros, busca, edição de ação e totais do rodapé continuam funcionando.
