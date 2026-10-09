# Changelog

## [1.37.2] - 2026-10-09
### Alterado
- Os status "01-DIGITADO" e "02-CRITICADO" aparecem em fonte vermelha no detalhe da rota, em Pedidos sem rota e no PDF de impressão, como já acontecia em Rotas Pendentes.


## [1.37.1] - 2026-10-09
### Alterado
- A coluna "Dt. agenda" passa a se chamar "Dt. fatur." no detalhe da rota, em Pedidos sem rota e no PDF de impressão. As datas exibidas permanecem as mesmas.

## [1.37.0] - 2026-10-09
### Alterado
- Custo de Frete: o frete passa a usar o mesmo critério de Mercadorias faturadas (frete real do ERP por nota ou, sem ele, o valor provisionado), igualando os totais das duas telas.

## [1.36.1] - 2026-10-09
### Adicionado
- Mercadorias faturadas: o card "Vlr. Frete" passa a exibir o % do frete sobre as mercadorias no canto superior direito, no mesmo estilo do valor.

## [1.36.0] - 2026-10-09
### Adicionado
- Mercadorias faturadas: notas sem frete real exibem os valores provisionados (frete, perna, diária, pernoite, reentrega, descarrego).
- Nova coluna ORIGEM_FRETE (R = real, P = provisionado) e total de frete dividido entre real e provisionado.

## [1.35.0] - 2026-10-09
### Alterado
- Base dos demonstrativos de custo com frete restrita às agendas 417 e 427: Sync ERP passa a gravar só essas agendas e as telas (Custo de Frete, "% Frete do ciclo" e detalhamento de Mercadorias faturadas) ignoram as demais.

## [1.34.0] - 2026-10-09
### Alterado
- Custo de Frete, card "% Frete do ciclo" e detalhamento de Mercadorias faturadas passam a considerar todas as notas faturadas do ciclo, inclusive as já entregues (antes só as entregas em aberto). Requer o script `db/central/2026-10-09_notas_faturadas.sql` e um Sync ERP.

## [1.33.1] - 2026-10-09
### Corrigido
- Detalhamento de Mercadorias faturadas não listava as notas (erro ao ler o vínculo pedido → rota).

## [1.33.0] - 2026-10-09
### Adicionado
- Card "Mercadorias faturadas" do painel Custo de Frete abre o detalhamento por nota no layout da planilha do ERP, com busca, ordenação, totais e exportação para Excel.
- Sync ERP passa a trazer Dt. entrega transportadora, transportador principal e valores de frete (frete, perna, diária, pernoite, reentrega, descarrego) — requer o script `db/central/2026-10-09_entregas_detalhe_frete.sql`.

## [1.32.1] - 2026-10-09
### Alterado
- Rotas Pendentes: o card "% Frete do ciclo" agora aparece antes do card "Pedidos pendentes sem rota".

## [1.32.0] - 2026-10-09
### Adicionado
- Tabelas de frete: consulta e manutenção dos municípios de cada praça (buscar, adicionar, remover e mover entre praças).
### Corrigido
- Salvar a tabela de frete não apaga mais a lista de municípios das praças.

## [1.31.0] - 2026-10-09
### Adicionado
- Provisionamento: busca de praça digitando parte do nome do município, com a praça correspondente ao lado.

## [1.30.4] - 2026-10-09
### Alterado
- Gravação do provisionamento de frete no ERP mais rápida: números da sequência obtidos de uma vez e notas gravadas em lotes paralelos de 5.

## [1.30.3] - 2026-10-09
### Alterado
- Praças da tabela TABELA-FRACIONADA (Solution) refeitas conforme a planilha da transportadora: 196 cidades em 8 praças, reconhecidas automaticamente no provisionamento e na auditoria de CT-e.

## [1.30.2] - 2026-10-09
### Alterado
- "Baixar tabela original": o arquivo da tabela de frete é baixado direto na área de downloads (sem abrir nova aba).

## [1.30.1] - 2026-10-09
### Corrigido
- "Ver tabela original" não é mais bloqueado pelo navegador (Edge): o arquivo é aberto/baixado pelo próprio app.

## [1.30.0] - 2026-10-09
### Adicionado
- Detalhe do CT-e: botão "Ver tabela original" na seção de auditoria abre o arquivo original da tabela de frete usada na auditoria; sem auditoria, oferece o arquivo da tabela vigente na emissão do CT-e.

## [1.29.3] - 2026-10-09
### Alterado
- Provisionamento de frete: tabelas vencidas aparecem com o selo "vencida" e um aviso; entregas sem tabela vigente mostram "sem tabela vigente" em vez de "praça não encontrada"; atalho para editar a tabela de frete.

## [1.29.2] - 2026-10-08
### Corrigido
- Rotas montadas e expedidas entre dois Sync ERP (ex.: rota 459) passam a receber os pedidos, o borderô e o fretista do ERP e voltam a aparecer em "Autorizar pagamento de frete".

## [1.29.1] - 2026-10-08
### Corrigido
- Painel Custo de Frete e card "% Frete do ciclo" voltam a exibir os dados.
- Painel Custo de Frete passa a ter sempre o botão "Voltar".

## [1.29.0] - 2026-10-08
### Adicionado
- Rotas Pendentes: card "% Frete do ciclo" com o frete confirmado sobre os pedidos faturados no ciclo comercial atual.
- Novo painel "Custo de frete": totais, evolução de 6 ciclos e detalhamento por fretista/transportadora, UF, cidade, cliente, vendedor e rota, com exportação.

## [1.28.1] - 2026-10-08
### Alterado
- Card "Pedidos pendentes sem rota" (Rotas Pendentes): os rótulos e valores de Pedidos e Entregas agora ficam alinhados à direita, com mais espaço entre as colunas, para melhorar a leitura.

## [1.28.0] - 2026-10-08
### Adicionado
- Provisionamento de frete: ao abrir, mostra o que já está gravado no ERP e compara com o cálculo atual.
- Aviso de divergência e botão "Substituir pelos novos valores"; botão "Recalcular".
### Corrigido
- Primeira gravação do provisionamento não chama mais a marcação de substituídos (evita erro de bind no ERP).

## [1.27.4] - 2026-10-08
### Alterado
- Autorizar pagamento de frete: rotas com crítica pendente deixam de mostrar o valor estimado do provisionamento — permanece só a exclamação vermelha com os motivos no popup. Valores já confirmados ou já gravados continuam aparecendo.

## [1.27.3] - 2026-10-08
### Alterado
- Autorizar pagamento de frete: as críticas de provisionamento não ocupam mais linhas de texto na coluna Frete — aparece apenas uma exclamação vermelha, e o detalhe continua no popup ao posicionar o mouse.

## [1.27.2] - 2026-10-08
### Corrigido
- Autorizar pagamento de frete: a listagem agora informa por rota as críticas que impediram ou tornaram parcial o provisionamento, incluindo transportadora não identificada, tabela ausente, entrega sem município e praça não encontrada.

## [1.27.1] - 2026-10-08
### Corrigido
- Tabelas de frete: diálogo "Nova tabela de preço" maximizado (quase tela cheia) e grade de preços por origem/destino ajustada para caber sem rolagem lateral.

## [1.27.0] - 2026-10-08
### Adicionado
- Transportadoras: "Atualizar cadastro do ERP" passa a importar todas as transportadoras (natureza ET) do ERP que ainda não estão no cadastro, sem sobrescrever dados bancários ou tabela de frete.

## [1.26.0] - 2026-10-08
### Adicionado
- Provisionamento de frete: escolha da praça da tabela para cidades não encontradas (e troca na composição da entrega); a escolha é gravada na tabela e passa a valer para próximas rotas e auditorias de CT-e.

## [1.25.0] - 2026-10-08
### Alterado
- Provisionamento de frete: notas agrupadas por entrega (cliente + cidade); o frete é calculado uma vez por entrega e rateado entre as notas pelo peso (mínimo, despacho e TAS não se repetem por nota).
### Adicionado
- Provisionamento de frete: composição detalhada do cálculo por entrega (praça, peso cobrado, frete peso/valor, mínimo, despacho, GRIS, ad valorem, TAS, ICMS), total de mercadorias e % do frete por nota, entrega e rota.

## [1.24.5] - 2026-10-08
### Adicionado
- Autorizar pagamento de frete: crítica visível na listagem quando a transportadora da rota não tem tabela de frete vigente vinculada, orientando o usuário a vincular uma tabela pelo lápis.

## [1.24.4] - 2026-10-08
### Adicionado
- Provisionamento de frete: quando a transportadora da rota não tem tabela de frete vigente, o modal agora permite vincular uma tabela existente à transportadora sem sair da tela, recalculando o provisionamento automaticamente.

## [1.24.3] - 2026-10-08
### Corrigido
- Botão "Voltar" agora retorna sempre à tela anterior (antes podia não responder na tela da rota).

## [1.24.2] - 2026-10-08
### Alterado
- Tabelas de frete: a listagem agora mostra todas as transportadoras vinculadas a cada tabela (não só a principal), e o cadastro exibe o código do ERP entre parênteses após o nome de cada transportadora, facilitando identificar e vincular a mesma tabela a várias transportadoras.

## [1.24.1] - 2026-10-08
### Alterado
- Provisionamento de frete: o ID de cada linha gravada no ERP agora é obtido pelo app via `SEQ_PROVISAO_FRETE.NEXTVAL` antes do insert — a tabela não precisa mais de trigger. Novo script Oracle v3 (db/erp/2026-10-08_a_ger_provisao_frete_v3.sql) e o comando `insert_provisao_frete` passa a receber o bind `id`.

## [1.24.0] - 2026-10-08
### Adicionado
- Autorizar pagamento de frete: rotas de transportadora abrem o "Provisionar frete", que calcula o custo por nota fiscal pela tabela de frete vigente e grava no ERP (GKS.A_GER_PROVISAO_FRETE) com a memória de cálculo; ao gravar, a rota fica "Confirmado".
- Script Oracle de criação da tabela e dos comandos da API do ERP (db/erp/2026-10-08_a_ger_provisao_frete.sql).

## [1.23.2] - 2026-10-06
### Removido
- Botões "Iniciar rota", "Concluir rota", "Cancelar" e "Emitir borderô" removidos da tela de detalhe da rota: eles alteravam status apenas no app, sem refletir no ERP. A gestão de status/borderô continua sendo feita pelo ERP e pelo Sync ERP. O botão "Excluir rota" (rotas vazias) permanece.

## [1.23.1] - 2026-10-06
### Corrigido
- Telas do menu abertas a partir de outra tela (ex.: Pedidos sem rota pelo card de Rotas Pendentes) agora mostram "Voltar para <tela anterior>".

## [1.23.0] - 2026-10-06
### Alterado
- Telas de detalhe (pedido, rota, CT-e, NF-e) ganharam botão "Voltar" que retorna à tela que as abriu, mantendo filtros; links diretos voltam à tela padrão.

## [1.22.1] - 2026-10-06
### Corrigido
- Distância de clientes localizados só como "Brasil" ou só pelo bairro (ex.: 216720 com 1.986 km): localizações ruins foram descartadas e passam a usar bairro/cidade até nova localização.
- Sync ERP só localiza clientes com cidade e UF e ignora respostas genéricas do Google (país/estado).

## [1.22.0] - 2026-10-06
### Alterado
- Autorizar pagamento de frete: rotas em que nenhum pedido saiu (borderô sem data de saída) não aparecem mais na tela e continuam em Rotas Pendentes.
- Rotas com expedição parcial aparecem com a crítica "Expedição incompleta", e a confirmação fica bloqueada até excluir os pedidos não expedidos ou até a expedição terminar.
- A auditoria do pagamento lista os pedidos "Não expedidos" com a opção de excluir da rota, e o servidor recusa a confirmação enquanto eles existirem.

## [1.21.2] - 2026-10-04
### Corrigido
- O contador de páginas da pré-visualização de impressão não mostra mais uma página a mais: a estimativa agora mede o conteúdo real da folha, e não a altura mínima da página.
- O filtro "Mês" do Dashboard não fica mais limitado aos 500 pedidos mais recentes: a consulta passa a carregar todos os pedidos dos últimos 13 meses, em lotes, para que meses anteriores mostrem os totais completos.

## [1.21.1] - 2026-10-03
### Alterado
- O filtro de mês do Dashboard (e o gráfico "Pedidos por mês") passam a considerar a data da agenda do pedido — a data de faturamento — em vez da data de criação. Pedidos sem data de agenda continuam contados usando a data do pedido.

## [1.21.0] - 2026-10-03
### Adicionado
- O Dashboard ganhou o filtro "Mês", que respeita o modo de calendário escolhido: meses civis no modo normal e meses comerciais do ERP (com o período entre parênteses, ex.: "set/26 (26/08 a 25/09)") no modo comercial. Ao abrir ou trocar o modo, o filtro posiciona no mês vigente. O filtro vale para os cartões de indicadores e para a lista "Pedidos por status"; o gráfico "Pedidos por mês" segue mostrando a tendência dos últimos 6 meses.

## [1.20.1] - 2026-10-03
### Corrigido
- Dashboard: o calendário comercial agora é recarregado logo após o Sync ERP; o aviso mostra o motivo real e tem botão "Tentar novamente".

## [1.20.0] - 2026-10-03
### Adicionado
- O Dashboard ganhou o seletor "Analisar por: Calendário normal / Calendário comercial". No modo comercial, o gráfico "Pedidos por mês" agrupa os pedidos pelos meses comerciais do ERP (períodos de/até), com o período exato no tooltip. A escolha fica salva no perfil do usuário. Se o calendário comercial ainda não estiver carregado, o app avisa e mantém a visão normal.

## [1.19.1] - 2026-10-03
### Corrigido
- A pré-visualização da impressão agora estima a quantidade de páginas (ex.: "Página 1 de 3") em um selo fixo no canto inferior direito da tela, em vez do texto fixo "Página 1 de 1" escondido no fim do conteúdo.
- Rotas com borderô emitido em apenas parte dos pedidos voltam a aparecer em "Rotas Pendentes" — antes elas sumiam das duas telas e o frete ficava impossível de autorizar.

## [1.19.0] - 2026-10-03
### Adicionado
- O botão "Sync ERP" agora também atualiza o calendário comercial do ERP (período de datas de cada mês comercial).
- A tela Pedidos ganhou o filtro "Mês comercial", que mostra apenas os pedidos cuja data cai dentro do período do mês selecionado.

## [1.18.3] - 2026-10-02
### Corrigido
- A marcação "Página X de Y" agora fica visível no canto inferior direito da folha mostrada no app e permanece em todas as páginas do PDF impresso.

## [1.18.2] - 2026-10-02
### Adicionado
- Ao salvar a impressão da rota em PDF, o arquivo é sugerido como RT_<código da rota>_<data>.pdf (ex.: RT_461_20261002.pdf); o contador "Página X de Y" no canto inferior direito já aparece no PDF salvo.

## [1.18.1] - 2026-10-02
### Alterado
- A impressão abre inicialmente em modo Retrato e organiza cada entrega em uma linha totalizadora, seguida pelo detalhamento dos pedidos.

## [1.18.0] - 2026-10-02
### Adicionado
- A última configuração de impressão (papel, orientação, fonte, seções e ordenação) fica salva no perfil do usuário e é sugerida na próxima impressão, em qualquer computador.

## [1.17.2] - 2026-10-02
### Alterado
- A impressão da rota agora abre na mesma aba do app (teste e oficial), sem pedir login; "Voltar" retorna à tela anterior.

## [1.17.1] - 2026-10-02
### Corrigido
- Impressão da rota não pede mais login ao abrir: no editor abre na própria tela; na oficial abre em nova aba mantendo a sessão.
## [1.17.0] - 2026-10-02
### Adicionado
- Impressão do detalhamento da rota (ícone de impressora em Rotas Pendentes, Autorizar pagamento de frete e botão no detalhe): pré-visualização, escolha de seções, papel A4/Carta, retrato/paisagem, tamanho de fonte, modo econômico, ordenação, numeração de páginas, assinaturas e salvar em PDF.

## [1.16.15] - 2026-10-02
### Corrigido
- Rotas Pendentes e Autorizar pagamento: a coluna Distância (km) passa a ser calculada automaticamente para todas as rotas, localizando as entregas pelo pedido, pelo cliente ou (aproximado, com "≈") pelo bairro/cidade — mesma regra do mapa do detalhe.

## [1.16.14] - 2026-10-02
### Corrigido
- Rotas Pendentes: a coluna Distância (km) passa a receber a mesma quilometragem calculada no mapa do detalhe da rota, inclusive com localizações aproximadas por bairro ou cidade.

## [1.16.13] - 2026-10-02
### Corrigido
- Sync ERP atualiza o status das rotas com o ERP; rotas encerradas/excluídas no ERP (ex.: 433 e 434) saem de Rotas Pendentes.

## [1.16.12] - 2026-10-02
### Corrigido
- Autorizar pagamento de frete: só exibe rotas com borderô informado em todos os pedidos; rotas marcadas sem nenhum borderô continuam em Rotas Pendentes (ex.: rota 457).

## [1.16.11] - 2026-10-02
### Adicionado
- Confirmar pagamento: UF, cidade e bairro do cliente abaixo do nome em cada pedido, e total de mercadorias no totalizador de cada filial.

## [1.16.10] - 2026-10-02
### Adicionado
- Confirmar pagamento: peso de cada pedido na tabela por filial, subtotal de peso no cabeçalho da filial e peso total na linha de totais.

## [1.16.9] - 2026-10-02
### Corrigido
- Pedidos sem rota: rotas sem número no ERP não aparecem mais para atribuição; seleções desatualizadas agora exibem uma mensagem clara em vez de informar zero pedidos atribuídos.

## [1.16.8] - 2026-10-02
### Corrigido
- Rotas Pendentes: o card de pedidos pendentes sem rota agora fica oculto quando não há pedidos aguardando atribuição.

## [1.16.7] - 2026-10-01
### Adicionado
- Confirmar pagamento: o código do cliente no ERP aparece entre parênteses após o nome do cliente na tabela por filial.

## [1.16.6] - 2026-10-01
### Alterado
- Detalhe da rota: colunas Valor e Peso movidas para antes de OBS, com os totais por entrega acompanhando a nova posição.
### Adicionado
- Detalhe da rota: coluna Borderô por pedido, logo após NF.

## [1.16.5] - 2026-10-01
### Alterado
- Removido o "#" antes do ID da rota na seleção de rota existente.

## [1.16.4] - 2026-10-01
### Alterado
- Pedidos sem rota: na seleção de rota existente, o ID da rota aparece antes do nome (ex.: #423 · nome).


## [1.16.3] - 2026-10-01
### Corrigido
- Atribuir rota: pedidos agora são incluídos no ERP pela API insert_pedido_na_rota (nova rota e rota existente); só os aceitos pelo ERP ficam vinculados no app e as falhas aparecem no aviso.

## [1.16.2] - 2026-10-01
### Alterado
- Rotas Pendentes: card "Pedidos pendentes sem rota" aparece sempre, para todos os perfis; pulsa só quando há pedidos, mostra "Carregando…" e, em caso de erro, "Tentar novamente".
- Pedidos sem rota: colunas Valor e Peso em cada pedido.

## [1.16.1] - 2026-10-01
### Adicionado
- Detalhe da rota: valor e peso de cada pedido e totais (valor, peso e quantidade de pedidos) na linha de cada entrega.

## [1.16.0] - 2026-10-01
### Adicionado
- Botão "Excluir rota" no detalhe de rotas sem pedidos (Administrador/Gestor): grava status E no ERP e remove a rota do app.
### Alterado
- Rotas Pendentes mostra apenas rotas com status P no ERP.
- Sync ERP ignora rotas com status E.

## [1.15.7] - 2026-10-01
### Corrigido
- Sync ERP: rota recém-criada (ainda sem pedidos) não some mais de Rotas Pendentes após a sincronização.

## [1.15.6] - 2026-10-01
### Corrigido
- Rotas Pendentes: a rota recém-criada aparece na listagem imediatamente, mesmo ainda sem pedidos. A tela "Autorizar pagamento de frete" continua ocultando rotas vazias.

## [1.15.5] - 2026-10-01
### Alterado
- Nova rota: o número da rota é reservado primeiro na sequência do ERP e enviado na gravação, garantindo o mesmo número no ERP e no app.

## [1.15.4] - 2026-10-01
### Corrigido
- Detalhe da rota: clientes sem localização exata aparecem no mapa pela posição aproximada do bairro ou cidade, com o selo "≈ bairro"/"≈ cidade".
- Sync: a busca de localização usa o endereço do cadastro do cliente no ERP e prioriza clientes de pedidos em aberto.

## [1.15.3] - 2026-10-01
### Corrigido
- Detalhe da rota: a lista abaixo do mapa mostra todas as entregas. Pedidos sem localização aparecem no fim, com o aviso "Endereço não localizado".

## [1.15.2] - 2026-10-01
### Alterado
- Autorizar pagamento de frete: rotas sem nenhum pedido associado ficam ocultas, mesmo com borderô no ERP. Elas voltam a aparecer assim que os pedidos forem importados pela auditoria.

## [1.15.1] - 2026-10-01
### Corrigido
- Autorizar pagamento: a tarefa do Bitrix volta a ser criada na hora, e o resultado aparece na tela.
- Se a criação falhar, a nova tentativa ocorre em 1 minuto (antes esperava 30 minutos), até 10 tentativas.
- Usuário sem vínculo com o Bitrix agora gera pendência visível na fila, em vez de travar o item.

## [1.15.0] - 2026-10-01
### Adicionado
- Novo status de pagamento "Confirmado c/ pendência" quando a tarefa do Bitrix não é criada de primeira.
- Ícone de alerta pulsante ao lado do ID da rota, com explicação da pendência ao passar o mouse.
### Alterado
- A tarefa do Bitrix é tentada novamente a cada minuto, até 10 vezes; o reenvio manual reinicia a contagem.

## [1.14.5] - 2026-10-01
### Corrigido
- Autorizar pagamento de frete: rotas com borderô emitido cujos pedidos ainda não estavam no app (ex.: rota 423) agora aparecem e têm os pedidos importados do ERP automaticamente.

## [1.14.4] - 2026-10-01
### Removido
- Rota "NÃO PLANEJADO" deixa de ser criada pela sincronização; pedidos sem rota seguem em "Pedidos sem rota".
- Excluídas as rotas sem cadastro no ERP (rota-teste-20261001 e nao-planejado-40000101).


## [1.14.3] - 2026-10-01
### Corrigido
- "Nova rota" agora cadastra a rota no ERP (insert_ger_rota) e grava o número oficial; se o ERP recusar, a rota não é criada e o erro aparece.
- Criação de rota em "Pedidos sem rota" usava comando errado do ERP; passa a usar insert_ger_rota e lê o ID devolvido.

## [1.14.2] - 2026-10-01
### Adicionado
- Pedidos sem rota → Rota existente: cartão "Pedidos selecionados" mostra valor, peso, entregas e composição por UF/cidade dos pedidos escolhidos, no mesmo formato dos cartões de rota.

## [1.14.1] - 2026-09-30
### Corrigido
- Localização aproximada de bairro/cidade: falhas temporárias do Google Maps não ficam mais gravadas para sempre; locais sem coordenada são consultados de novo após 7 dias.
- Detalhe da rota: falha na consulta ao ERP agora mostra erro em vez de tabela vazia.
- Banco central: erro claro se a configuração apontar para o banco do próprio app.

## [1.14.0] - 2026-09-30
### Adicionado
- Pedidos sem rota → Rota existente: opção para mostrar só rotas com entregas nas mesmas cidades dos pedidos escolhidos.
- Cada rota existente agora mostra valor total, peso, quantidade de entregas e resumo de UF/cidades, com busca por nome.

## [1.13.1] - 2026-09-30
### Removido
- Rotas Pendentes: o botão "Atualizar rotas" (e o indicador "Atualizado há X minutos") saiu da tela; a sincronização continua disponível no cabeçalho do app.

## [1.13.0] - 2026-09-30
### Adicionado
- Nova rota: o responsável (fretista, transportadora ou frota própria) agora é escolhido em uma lista pesquisável por nome ou código, igual à tela de edição de rota.
### Removido
- Nova rota: removidos os campos "Frete total (R$)" e "Observações" — a rota nasce com frete zerado e observação padrão.


## [1.12.0] - 2026-09-30
### Adicionado
- Pedidos sem rota: os filtros de Estado, Cidade e Bairro agora podem ser ordenados pela descrição (A–Z) ou pela distância em km do depósito, com a quilometragem exibida em cada item da lista.

## [1.11.3] - 2026-09-30
### Corrigido
- Pedidos sem rota: distância aproximada até bairro/cidade agora usa a localização do Google Maps (guardada para reuso) e, na falta dela, o ponto central dos clientes vizinhos ignorando cadastros com localização errada; distâncias improváveis deixam de ser exibidas.

## [1.11.2] - 2026-09-30
### Alterado
- Pedidos sem rota: quando o endereço exato não foi localizado, a quilometragem passa a ser aproximada até o bairro (ou, na falta dele, até a cidade), com selo "≈ bairro" ou "≈ cidade" indicando a aproximação.

## [1.11.1] - 2026-09-29
### Corrigido
- Pedidos sem rota agora calcula a quilometragem usando primeiro as coordenadas específicas do pedido e identifica claramente os endereços ainda não localizados.

## [1.11.0] - 2026-09-29
### Alterado
- Pedidos sem rota agora agrupa cada cliente uma única vez, ordena por distância nos níveis UF, cidade, bairro e cliente e exibe os detalhes operacionais dos pedidos e suas observações sem rolagem lateral.

## [1.10.1] - 2026-09-29
### Corrigido
- Fretistas voltam a abrir o pedido a partir de "Minhas Rotas" e das notificações sem a mensagem "Você não tem acesso a esta tela".

## [1.10.0] - 2026-09-29
### Alterado
- A lista de pedidos abaixo do mapa da rota agora agrupa por cliente, segue a ordem de entrega e mostra status, filial, nota, vendedor, agenda, datas e observações (ao passar o mouse).

## [1.9.3] - 2026-09-29
### Alterado
- A capa da rota agora exibe no resumo o percentual do frete, a quantidade de pedidos e o peso total.
- O campo "Fretista interno" não aparece mais no modo de visualização; a alteração do responsável permanece no botão "Editar".

## [1.9.2] - 2026-09-29
### Corrigido
- A listagem de Rotas Pendentes agora reserva espaço para todas as colunas e exibe integralmente os valores e a ação de edição, sem rolagem lateral.

## [1.9.1] - 2026-09-29
### Corrigido
- As linhas totalizadoras de Rotas Pendentes agora têm destaque próprio, diferente do foco das rotas, e exibem a data completa na coluna correta.

## [1.9.0] - 2026-09-29
### Alterado
- Rotas Pendentes agora abre os grupos de datas já expandidos, mantendo o controle individual para comprimir e reabrir.
- A listagem de Rotas Pendentes foi compactada para exibir todas as colunas na largura disponível do computador, sem rolagem lateral.

## [1.8.5] - 2026-09-29
### Corrigido
- Pedidos sem rota: pedidos que ainda estavam no agrupamento anterior (ex.: "NÃO PLANEJADO") agora são movidos para a rota escolhida, em vez de dar erro de pedido duplicado.

## [1.8.4] - 2026-09-29
### Corrigido
- Pedidos sem rota: atribuir a uma rota existente funciona mesmo quando a sincronização com o ERP recriou a rota no meio do processo (busca pelo número da rota no ERP).

## [1.8.3] - 2026-09-29
### Corrigido
- Pedidos sem rota: ao atribuir a uma rota que foi removida/reorganizada pela sincronização do ERP, o app avisa com mensagem clara e atualiza a lista de rotas; a lista é recarregada sempre que o painel é aberto.

## [1.8.2] - 2026-09-29
### Corrigido
- Os valores dos cards de indicadores (Rotas Pendentes) não quebram mais em duas linhas; fonte reduzida para caber.
- O card "Pedidos pendentes sem rota" agora mostra os quatro totais em grade 2x2 (Mercadorias | Pedidos / Peso | Entregas), mantendo a mesma altura dos demais cards.

## [1.8.1] - 2026-09-29
### Alterado
- O card "Pedidos pendentes sem rota" agora ocupa a mesma linha dos indicadores, na última posição à direita, e some quando não há pedidos pendentes.

## [1.8.0] - 2026-09-29
### Adicionado
- Rotas Pendentes ganhou um card com valor, peso, pedidos e entregas sem rota; quando há pendências, o fundo pisca em vermelho claro e o clique abre a tela "Pedidos sem rota".

## [1.7.4] - 2026-09-29
### Alterado
- Na coluna "Pedidos por status", os status "01-DIGITADO" e "02-CRITICADO" aparecem em vermelho (código e contagem).

## [1.7.3] - 2026-09-29
### Alterado
- Código da rota exibido sem o prefixo "ID" em todas as telas; coluna do código mais estreita.
- Coluna "Pedidos por status" mais larga e sem quebra de linha em nenhum status (ex.: "09-CONFERIDO").

## [1.7.2] - 2026-09-29
### Alterado
- Na listagem de rotas, os status longos do ERP agora aparecem abreviados ("06-SEP. SOLIC.", "03.1-*LIB-CRIT.", "04-LIB. PRO"), para cada status caber em uma única linha na coluna "Pedidos por status".

## [1.7.1] - 2026-09-29
### Corrigido
- Rotas que ficaram sem pedidos no ERP (ex.: 411) não mostram mais pedidos/entregas antigos: a conferência com o ERP passa a remover os vínculos também quando a rota está vazia (exceto rotas com pagamento confirmado).

## [1.7.0] - 2026-09-29
### Alterado
- Gestor agora pode lançar valor adicional na rota em "Autorizar pagamento de frete"; reabrir/substituir o frete já confirmado continua exclusivo do administrador.

## [1.6.1] - 2026-09-29
### Alterado
- Confirmar pagamento mais rápido: reaproveita a conferência feita ao abrir o lápis (até 2 min), grava no ERP até 5 pedidos ao mesmo tempo e cria a tarefa do Bitrix em segundo plano (falhas vão para a fila de pendências).

## [1.6.0] - 2026-09-29
### Alterado
- A versão oficial passa a ter todas as funcionalidades do teste ao publicar: menu lateral automático (computador) e conferência dos pedidos da rota com o ERP em Autorizar pagamento de frete.

## [1.5.2] - 2026-09-29
### Alterado
- Histórico de status do pedido (clique no código do pedido) liberado também na versão oficial, para todos os tipos de usuário.

## [1.5.1] - 2026-09-29
### Corrigido
- Pedidos reexpedidos após ocorrência (borderô com status O) passam a usar o borderô novo no detalhamento da autorização de pagamento e na tarefa do Bitrix (ex.: pedido 4135213 → borderô 32381). Rotas já pagas mantêm o borderô gravado.

## [1.5.0] - 2026-09-29
### Adicionado
- Autorizar pagamento de frete: ao abrir a tela ou o lápis, o app confere os pedidos de cada rota no ERP e iguala o app (remove os que saíram da rota e inclui os que faltam). Nada é alterado no ERP. Rotas com pagamento confirmado só exibem aviso. Ligado apenas no teste.

## [1.4.0] - 2026-09-29
### Adicionado
- Clique no código do pedido (em todas as telas) abre o histórico de status do pedido registrado no ERP (ligado só no ambiente de TESTE).

## [1.3.0] - 2026-09-29
### Adicionado
- Gestor/Administrador pode atribuir o responsável de uma rota sem responsável; a alteração é gravada no ERP.
### Corrigido
- A seta de voltar da rota retorna para a tela de origem (Rotas Pendentes ou Autorizar pagamento de frete).

## [1.2.0] - 2026-09-29
### Alterado
- Usuários com papel Gestor podem autorizar pagamento a fretista (rotas) e aprovar/autorizar pagamento de CT-e.

## [1.1.3] - 2026-09-29
### Corrigido
- Vínculo com o Bitrix agora é gravado mesmo para usuários sem perfil no banco central (ex.: Gutemberg); a tela avisa se a gravação falhar.

## [1.1.2] - 2026-09-29
### Corrigido
- Menu lateral automático (teste): no computador o menu inicia recolhido, abre ao passar o mouse e recolhe ao sair; o botão do topo fixa o menu aberto.

## [1.1.1] - 2026-09-29
### Corrigido
- A crítica de falta de PIX só aparece quando o tipo do responsável é fretista (F). Para transportadoras e frota própria, atualizar o cadastro informa apenas que os dados foram atualizados, sem mencionar PIX.

## [1.1.0] - 2026-09-29
### Adicionado
- Aviso em vermelho nas telas de rotas quando o tipo do fretista no ERP não é EF/ET/EM (ou o código não existe no cadastro), com botão para consultar o ERP novamente.
- Menu lateral abre ao passar o mouse e recolhe ao sair, no computador (ligado só no ambiente de TESTE).

## [1.0.1] - 2026-09-29
### Alterado
- A coluna "Tipo" (F fretista, T transportadora, P próprio) voltou a aparecer em todas as telas de rotas, sempre imediatamente após "Fret / Transp", inclusive na tela "Autorizar pagamento de frete".
- Responsáveis do ERP com natureza fora de EF/ET/EM (ex.: FT) agora mostram um selo âmbar com o código da natureza, em vez de "—" sem explicação.

### Corrigido
- A lista de responsáveis do ERP só trazia os 1.000 primeiros cadastros; códigos além disso ficavam sem tipo/PIX/natureza nas telas de rotas.
