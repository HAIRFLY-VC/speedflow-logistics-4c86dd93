# Tempos do painel de Separação por horário de expediente

Hoje o painel conta o tempo "corrido" entre a inclusão do pedido e o fim da separação. Um pedido incluído às 16h e separado às 9h do dia seguinte aparece com 17 horas, o que distorce produtividade e tempo médio.

## Regra de expediente a aplicar

- Segunda a quinta: 07:00 às 17:00
- Sexta: 07:00 às 16:00
- Sábado: 07:00 às 17:00
- Domingo/feriado: contam como 07:00 às 17:00 apenas quando houver movimentação (existir pedido com inclusão, início ou fim de separação naquele dia); caso contrário o dia é ignorado
- Almoço descontado todos os dias: 11:30 às 12:30
- Tempo fora do expediente não conta; o relógio pausa no fim do dia e volta às 07:00 do próximo dia útil

Exemplo pedido: incluído 16:00, separado 09:00 do dia seguinte (ambos seg–qui) → 1h + 2h = **3h**.

## Onde muda

- **Tempo médio de separação** (card): média das horas úteis entre inclusão e fim da separação.
- **Caixas por hora** (card): caixas do período ÷ soma das horas úteis.
- **Tempo médio** e **caixas/hora** por separador na tabela de produtividade.
- **Na fila / mais antigo há X** e a coluna "parado há" dos pedidos em aberto: também passam a usar horas úteis, para não acusar atraso durante a noite.
- **Envelhecimento da fila**: faixas calculadas em horas úteis.

Os gráficos por dia e por hora não mudam.

## Detalhes técnicos

- Novo módulo `src/lib/horas-uteis.ts` com `horasUteis(inicio, fim, diasComMovimento)`:
  - trabalha no fuso `America/Sao_Paulo`;
  - percorre dia a dia, monta a janela do dia (07:00–17:00, sexta 07:00–16:00, domingo só se houver movimento), intersecta com `[inicio, fim]` e desconta a interseção com 11:30–12:30;
  - devolve horas decimais, `null` se qualquer ponta for nula.
- `diasComMovimento`: `Set` de datas `yyyy-mm-dd` (BRT) derivado das linhas carregadas (`dt_inc`, `dt_ini_sep`, `dt_fim_sep`), calculado uma vez em `separacao.tsx` e passado ao cálculo.
- Em `src/routes/_authenticated/separacao.tsx`, substituir os usos de `horas(...)` por `horasUteis(...)` nos pontos listados acima, mantendo `dur()` para formatação.
- Sem mudanças na consulta ao ERP nem em `separacao.functions.ts`.
