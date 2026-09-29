# Rotas Pendentes expandidas e sem rolagem lateral

## Classificação

**MINOR — v1.9.0.** A tela muda seu comportamento padrão e passa a apresentar os detalhes das rotas imediatamente.

## O que será alterado

- Abrir todos os grupos de **Rotas Pendentes** já expandidos ao entrar na tela, no computador e no celular.
- Manter a opção de comprimir ou expandir cada grupo individualmente.
- Aplicar somente nessa tela o mesmo princípio de tabela compacta já usado em **Autorizar pagamento de frete**.
- Definir larguras proporcionais para as colunas, reduzir espaçamentos e fonte quando necessário e usar títulos verticais nas colunas estreitas.
- Preservar uma largura suficiente em **Pedidos por status** para os status continuarem em uma linha.
- Fazer a tabela ocupar apenas a largura disponível, sem exigir rolagem lateral no computador.
- Manter os cartões no celular, sem transformar a visualização móvel em uma tabela apertada.
- Preservar filtros, escolha e ordem de colunas, clique na rota, edição e demais ações existentes.

## Detalhes técnicos

- Adicionar ao componente compartilhado da tabela uma opção para iniciar grupos expandidos, mantendo o padrão atual nas demais telas.
- Passar essa opção apenas pela tela de Rotas Pendentes.
- Separar o critério de “layout compacto” do critério de “autorizar pagamento”, para que Rotas Pendentes possa receber larguras compactas sem ganhar regras do fluxo financeiro.
- Ajustar o layout da tabela compacta para respeitar a largura do quadro e impedir que conteúdos longos ampliem a tabela.

## Riscos e impacto

- **Banco compartilhado:** nenhum; não haverá migração nem alteração de dados.
- **Integrações:** nenhuma alteração.
- **Versão oficial:** mudança visual e de abertura inicial, sem alterar regras das rotas.
- **Feature flag:** nenhuma nova; ajuste visual de baixo risco e, conforme a política atual, a versão publicada deve ficar igual ao teste.

## Validação

- Conferir no preview que os grupos aparecem abertos ao carregar Rotas Pendentes.
- Conferir que cada grupo ainda pode ser comprimido e reaberto.
- Validar em tela de computador que todas as colunas visíveis cabem sem rolagem lateral e que os status não quebram.
- Validar no celular que os dados continuam em cartões legíveis e já expandidos.
- Confirmar que filtros, lápis de edição e clique na rota continuam funcionando.

## Checklist para publicar

- Testar os itens acima no preview em computador e celular.
- Migrações aplicadas: nenhuma.
- Flags para ligar após publicar: nenhuma.
- Reversão: retornar à versão 1.8.5 pelo histórico do Lovable; não há SQL de reversão.
