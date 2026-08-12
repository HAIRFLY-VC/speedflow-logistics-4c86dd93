# SpeedFlow Logistics

[P] PROPÓSITO

Quero construir um sistema chamado Speed Logística que resolve o seguinte problema de negócio:

Otimizar o tempo de entrega do pedido de venda de uma indústria de cosméticos, desde a chegada do pedido até a entrega no cliente.

O resultado esperado é: reduzir o tempo de entrega, reduzir o custo de logística e melhorar a experiência do cliente.

Este sistema será usado por: Diretoria, Gestores de logística, Operadores logísticos e Fretistas.

[A] ATUAÇÃO

Você atuará como engenheiro full-stack sênior especializado em:

React + TypeScript + TailwindCSS (frontend Lovable)

Supabase (Postgres, Auth, RLS, Storage, Edge Functions)

Boas práticas de UX/UI moderno (shadcn/ui, Lucide icons)

Arquitetura limpa, componentização e código pronto para produção

Padrões obrigatórios:

Sempre criar Row Level Security (RLS) em todas as tabelas

Sempre criar policies explícitas por papel de usuário

Sempre usar Supabase Auth para autenticação

Sempre validar dados no frontend E no backend

Componentes pequenos, reutilizáveis e tipados

[C] CONTEXTO

Sobre o negócio

Empresa/Projeto: Hairfly Cosméticos

Segmento: Indústria de cosméticos

Modelo de receita: Fabricação de cosméticos e venda para clientes B2B

Localização: Abreu e Lima, Pernambuco

Particularidade: A empresa não possui frota própria — toda entrega é feita por fretistas contratados.

Sobre os usuários do sistema

Os papéis (roles) que existirão no sistema são:

ADM — acesso total, gestão de usuários e configurações.

GESTOR — acompanha todo o fluxo, aprova exceções, vê todos os KPIs.

OPERADOR — executa o fluxo operacional (aprovações, faturamento, separação, roteirização).

FRETISTA — vê apenas suas próprias rotas, pedidos e entregas; registra a entrega e o canhoto.

Entidades principais (o que o sistema gerencia)

O sistema gerencia todo o fluxo do pedido de venda, desde a chegada até a entrega no cliente. As principais entidades são:

Clientes (B2B)

Produtos (catálogo da indústria)

Pedidos de venda e seus itens

Aprovações comerciais e de crédito

Faturamento (nota fiscal e boletos)

Separação (picking)

Fretistas

Rotas de entrega

Borderôs de entrega

Entregas

Canhotos (comprovante de entrega assinado)

Fluxo principal do usuário

O pedido percorre as seguintes etapas, em sequência:

O representante comercial visita o cliente e cadastra o pedido de venda.

O pedido entra no sistema e é analisado pelo departamento comercial conforme a política comercial. Se a política estiver correta, é aprovado; caso contrário, o gerente precisa aprovar ou reprovar manualmente.

Após a aprovação comercial, o pedido vai para o departamento de crédito, que aprova ou reprova conforme a análise da saúde financeira do cliente.

Após a aprovação de crédito, o pedido vai para o faturamento, que faz o atendimento do estoque necessário e libera para a equipe de separação.

O separador faz a separação física dos produtos e os posiciona em uma área próxima da expedição.

O roteirista contrata o fretista que fará a entrega e monta a rota.

O pedido é faturado: a nota fiscal e os boletos são emitidos.

É emitido o borderô de entrega com a listagem de todos os pedidos que o fretista está transportando.

O pedido é entregue no cliente.

O canhoto da nota fiscal, assinado pelo cliente, é registrado e arquivado.

Regras de negócio do fluxo

Esta é a parte mais importante do sistema. O pedido funciona como uma máquina de estados: ele tem um status que avança etapa por etapa, e só pode avançar para a próxima etapa se a etapa anterior foi concluída ou aprovada.

Os status do pedido, na ordem, são:

AGUARDANDO_APROVACAO_COMERCIAL → AGUARDANDO_APROVACAO_CREDITO → AGUARDANDO_FATURAMENTO → EM_SEPARACAO → AGUARDANDO_ROTEIRIZACAO → FATURADO → EM_TRANSPORTE → ENTREGUE

Status de exceção: REPROVADO_COMERCIAL, REPROVADO_CREDITO, CANCELADO.

Regras de transição:

Um pedido reprovado no comercial ou no crédito não avança e fica visível para o gestor resolver.

O pedido só entra em separação depois que o faturamento confirmou o atendimento de estoque.

O pedido só pode ser despachado (EM_TRANSPORTE) depois que está em um borderô vinculado a uma rota e a um fretista.

Cada mudança de status deve registrar quem fez, quando, e o status anterior (rastreabilidade).

Quero acompanhar os pedidos em um quadro Kanban por status, visualizando o pedido andando pelo fluxo.

Integrações externas

ERP GCF e Google Maps são pontos de integração futuros.

Nesta versão, NÃO conecte de verdade nessas integrações. Deixe a estrutura preparada: campos para número do ERP, chaves de API, coordenadas de geolocalização etc., mas sem tentar fazer chamadas reais. O código deve ficar pronto para receber a integração depois.

[E] EXECUÇÃO

O que você vai me entregar

1. Schema completo no Supabase

Crie todas as tabelas necessárias para suportar as entidades e o fluxo acima.

Inclua relacionamentos (foreign keys), índices e timestamps (created_at, updated_at).

Crie a tabela profiles ligada a auth.users com campo role.

Implemente a máquina de estados do pedido (status como enum).

Registre o histórico de mudanças de status (tabela de auditoria).

Crie RLS policies explícitas para cada role definido.

Me entregue o SQL completo pronto para rodar no Supabase.

2. Sistema de autenticação

Tela de login e cadastro usando Supabase Auth.

Proteção de rotas por role.

Redirecionamento pós-login para a tela correta de cada papel.

3. Telas mínimas obrigatórias

Dashboard com os seguintes KPIs:

Tempo médio do ciclo completo (do pedido até a entrega)

Pedidos em atraso de SLA (em tempo real)

Tempo médio gasto em cada etapa do fluxo

Custo médio de frete por pedido

Taxa de entrega no prazo (%)

Funil de pedidos por status (quantos pedidos em cada etapa)

Quadro Kanban dos pedidos por status.

CRUD completo de cada entidade (listar, criar, editar, excluir).

Tela de detalhe do pedido mostrando todo o histórico de status e em que etapa está.

Tela de configurações do usuário.

Tela de gestão de usuários (apenas para admin).

4. UX/UI

Layout responsivo (mobile + desktop) — o fretista usará no celular.

Sidebar com navegação por role (cada papel vê só o que pode acessar).

Dark mode opcional.

Feedback visual em toda ação (toasts de sucesso/erro).

Estados de loading e vazio bem desenhados.

5. Critérios de aceite

O sistema só está pronto quando:

✅ Eu consigo logar com cada role e ver telas diferentes.

✅ A RLS impede que um usuário veja dado que não pode acessar (ex: fretista só vê suas entregas).

✅ Toda regra de negócio do fluxo está implementada (o pedido só avança na ordem correta).

✅ Consigo ver os pedidos andando no Kanban por status.

✅ Não há erro no console em nenhuma tela.

✅ Funciona em mobile.

Ordem de construção

Construa em entregas pequenas, uma de cada vez. Não tente gerar tudo de uma vez. A cada entrega, pare e me mostre o resultado antes de seguir para a próxima. Siga esta ordem:

Schema completo do Supabase (tabelas + RLS).

Sistema de autenticação e proteção de rotas por role.

Dashboard com KPIs e quadro Kanban.

CRUD de Clientes e Produtos (cadastros base).

CRUD de Pedidos + tela de detalhe do pedido.

Fluxo de aprovações (comercial e crédito) com mudança de status.

Faturamento e separação.

Fretistas, rotas e borderô.

Entrega e canhoto (com upload de foto/assinatura).

Gestão de usuários e configurações.

Formato da resposta esperada

Primeiro, me devolva o plano de implementação (lista de passos).

Depois, comece a construir um item de cada vez, na ordem acima.

Ao final de cada entrega, me explique o que foi feito e o que falta.

Vamos começar pelo schema do Supabase. Me entregue o SQL completo.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0f575c65-0542-477f-8d03-b4c26e47b952).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
