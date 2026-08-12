# Plano: Tela de Configuração do Módulo de Auditoria de Fretes

## Objetivo
Criar uma tela central de configuração para o novo módulo de Auditoria de Fretes (CT-e), acessível apenas por administradores, reunindo todos os cadastros e parâmetros necessários para o fluxo funcionar.

## Escopo
A tela será uma nova rota `/configuracoes-fretes` adicionada ao menu lateral, visível apenas para usuários com papel `adm`. Ela não substituirá as telas existentes de Transportadoras, Tabelas de preço, CT-e, Auditoria e Pagamento; servirá como hub de configuração com atalhos e controles rápidos.

## O que já existe e será reaproveitado
- Menu lateral já contém os itens: Transportadoras, Tabelas de frete, CT-e, Auditoria de fretes, Pagamento de fretes.
- Tabelas de banco: `transportadoras`, `tabelas_preco_frete`, `tabelas_preco_frete_faixas`, `ctes`, `cte_auditorias`, `cte_divergencias`, `ordens_pagamento_frete`, `configuracoes_auditoria_frete`.
- Registro de tolerância inicial: `configuracoes_auditoria_frete` já possui o registro `id=1` com `tolerancia_valor=5.00` e `tolerancia_percentual=0.01`.
- Secrets já criados: `ERP_API_BASE_URL`, `ERP_API_KEY`, `CTE_INGEST_SECRET`.
- Bucket de storage: `cte-xml` já existe.
- Função `pode_autorizar_frete` considera usuários `adm` ou perfis com `profiles.pode_autorizar_pagamento_frete=true`.

## Funcionalidades da tela

### 1. Acesso e navegação
- Nova rota: `src/routes/_authenticated/configuracoes-fretes.tsx`.
- Adicionar item "Config. de fretes" no menu lateral (`AppShell.tsx`), visível apenas para `role === 'adm'`.
- A tela usará `AppShell` e terá cabeçalho com título e descrição.

### 2. Painel de status geral (checklist)
Exibir cards indicando se cada pré-requisito está OK ou pendente:
- Transportadoras cadastradas (contagem > 0).
- Tabelas de preço ativas cadastradas (contagem > 0).
- Tolerâncias configuradas (valores padrão já existem, mas indicar os valores atuais).
- Integração ERP de pagamento configurada (se `ERP_API_BASE_URL` e `ERP_API_KEY` estiverem preenchidos).
- Bucket de storage `cte-xml` existente.

Cada item terá um botão de ação rápida que abre a seção correspondente ou navega para a tela específica.

### 3. Seção: Transportadoras
- Mostrar a contagem e as três últimas transportadoras cadastradas.
- Botão "Gerenciar transportadoras" que navega para `/transportadoras`.
- Botão "Nova transportadora" que abre um modal simplificado (razão social, CNPJ, ativo) dentro da própria tela, para agilizar a carga inicial.

### 4. Seção: Tabelas de preço
- Mostrar a contagem de tabelas ativas e as vigências.
- Botão "Gerenciar tabelas" que navega para `/tabelas-frete`.
- Botão "Nova tabela" que abre um modal simplificado com os campos essenciais:
  - transportadora, nome, tipo de cálculo, vigência, frete mínimo, GRIS, Ad Valorem, pedágio, TAS, ICMS, UF destino.
- Se o tipo de cálculo for "peso", permitir adicionar até três faixas de peso no mesmo modal.

### 5. Seção: Tolerâncias de auditoria
- Formulário editável com dois campos:
  - Tolerância em R$.
  - Tolerância em %.
- Botão "Salvar" que atualiza o registro `id=1` de `configuracoes_auditoria_frete`.
- Texto explicativo: "O CT-e será considerado conforme quando a diferença estiver dentro de qualquer uma das tolerâncias."

### 6. Seção: Integração ERP de pagamento
- Formulário com campos:
  - URL base do ERP (salva no secret `ERP_API_BASE_URL`).
  - API key do ERP (salva no secret `ERP_API_KEY`).
- Não exibir a chave atual por segurança; usar placeholder "••••••".
- Botão "Salvar" invoca uma `server function` protegida que atualiza os secrets via API interna (sem expor valores no cliente).
- Indicador de modo atual: "Integração ativa" ou "Modo simulado (sem endpoint)".

### 7. Seção: Permissões de autorização de pagamento
- Listar usuários do sistema (tabela `profiles` + `auth.users`) com:
  - nome/e-mail,
  - papel atual (apenas `adm` ou `outros`),
  - toggle `Pode autorizar pagamento de frete` (`profiles.pode_autorizar_pagamento_frete`).
- Ação de salvar alteração no perfil selecionado.
- Observação: usuários `adm` já têm permissão implícita; a flag é para dar permissão a não-admins.

## Dados a carregar na tela
- Contagem de transportadoras.
- Contagem de tabelas de preço ativas.
- Registro de tolerância (`configuracoes_auditoria_frete` id=1).
- Lista de usuários com perfil e flag `pode_autorizar_pagamento_frete`.
- Status dos secrets `ERP_API_BASE_URL` e `ERP_API_KEY` (somente se estão preenchidos, não os valores).

## Ações implementadas
- Criar transportadora (modal simplificado).
- Criar tabela de preço (modal simplificado com faixas).
- Salvar tolerâncias.
- Salvar secrets de integração ERP.
- Atualizar flag `pode_autorizar_pagamento_frete` de um perfil.

## Validações e segurança
- Toda a rota deve ser acessível apenas a `adm` (verificar `role` no cliente e reforçar no servidor quando aplicável).
- Secrets de ERP não devem ser lidos nem exibidos no front; a server function deve retornar apenas um booleano indicando se estão preenchidos.
- A criação de tabela simplificada deve validar transportadora, nome e vigência antes de inserir.
- A atualização de tolerâncias deve limitar valores entre 0 e 100% e 0 a 100000 R$.

## Critérios de aceitação
- Administrador consegue abrir `/configuracoes-fretes` e visualizar o status de cada configuração.
- É possível criar uma nova transportadora sem sair da tela.
- É possível criar uma tabela de preço simplificada sem sair da tela.
- É possível ajustar as tolerâncias de auditoria.
- É possível configurar os secrets de integração ERP de pagamento.
- É possível conceder/revogar a permissão `pode_autorizar_pagamento_frete` para usuários não-admin.
- Usuários não-admin não veem o item no menu lateral e recebem redirecionamento/erro ao tentar acessar a URL.

## Notas técnicas
- Usar `createFileRoute` para `/configuracoes-fretes`.
- Usar `useAuth` para obter o papel do usuário e bloquear acesso.
- Usar `createServerFn` para atualização de secrets e permissões (não expor service role no cliente).
- Adicionar a rota no menu lateral com `roles: ['adm']`.
- Não alterar as rotas/funcionalidades existentes de Transportadoras e Tabelas de frete; apenas adicionar atalhos.
