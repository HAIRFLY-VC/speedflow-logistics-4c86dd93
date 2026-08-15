# Centralizar 100% do armazenamento no banco central

Objetivo: nenhuma tabela de dados fica na base do Lovable. Todo o esquema do SpeedFlow (pedidos, rotas, CT-e, tabelas de frete, auditoria, pagamentos, configurações, preferências) passa a viver no banco central Supabase, ao lado de `clientes`, `produtos`, `vendas`, `vendedores` e `ger_expedicao`. O app cria lá os objetos que faltarem.

## Decisões já confirmadas
- Pedidos referenciam o cliente pelo `cod_cliente` do banco central — sem tabela local de clientes.
- `products` e `order_items` deixam de existir.
- SpeedFlow continua dono de rotas/borderôs; `ger_expedicao` fica só como histórico do ERP.

## Como fica a arquitetura

Tudo o que hoje é lido/gravado via cliente Supabase do Lovable passa a ser lido/gravado por **server functions** que falam com o banco central pela conexão já configurada (`EXTERNAL_DB_URL`), sempre no servidor, com o usuário autenticado validado antes de cada operação.

```text
Navegador ──> server function (auth verificada) ──> banco central (Supabase)
                                   └─ nada de acesso direto do navegador ao banco
```

Um esquema dedicado `speedflow` é criado no banco central para os objetos do app, evitando colisão com as tabelas do ERP que já usam `public`.

## Etapas

1. **Espelhar o esquema no banco central**
   Criar no banco central, dentro do esquema `speedflow`, todas as tabelas, enums, funções e gatilhos que hoje existem na base do Lovable — com `orders.erp_cod_cliente` no lugar da tabela de clientes, e sem `products`/`order_items`. Inclui o cache de geocodificação por `cod_cliente`.

2. **Migrar os dados existentes**
   Copiar CT-es, transportadoras, empresas, tabelas de frete, auditorias, pedidos, rotas, borderôs, notas, configurações e papéis de usuário da base atual para o banco central, convertendo o vínculo de cliente para `cod_cliente`.

3. **Trocar a camada de acesso do app**
   Substituir as chamadas diretas `supabase.from(...)` das telas por server functions sobre o banco central. Cada tela passa a consumir dados via consulta no servidor, mantendo a mesma interface visual.

4. **Arquivos XML e comprovantes**
   Os buckets de arquivos (`cte-xml`, `nfe-xml`, `delivery-receipts`, `tabelas-frete`) passam para o Storage do projeto central; os caminhos gravados nas tabelas acompanham.

5. **Desativar o armazenamento local**
   Depois que tudo estiver lendo do central e validado, remover as tabelas e buckets da base do Lovable.

## Ponto que preciso decidir com você: login

O login hoje usa o serviço de autenticação da base do Lovable, e as contas/papéis de usuário vivem lá. Para não sobrar nada na base do Lovable, o login também precisa passar para o projeto central. Isso exige que você me informe, do projeto Supabase central:
- a URL do projeto (`https://<ref>.supabase.co`);
- a chave pública (anon/publishable).

Com esses dois valores eu movo autenticação, perfis e papéis para lá. Os usuários precisarão redefinir a senha uma vez, já que as senhas não podem ser transferidas entre projetos.

Se você preferir manter o login onde está por enquanto, deixamos apenas as contas na base do Lovable e todo o resto dos dados vai para o central — nesse caso a base do Lovable fica só com autenticação, sem tabelas de negócio.

## Observação técnica
A conexão direta com o banco central foi validada no preview. Como todo o app passará a depender dela, vale publicar cedo para confirmar que o ambiente publicado permite a conexão; se houver bloqueio, troco a camada de acesso para a API do próprio projeto central sem mudar as telas.
