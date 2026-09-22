# Mensagens do sistema sempre em português do Brasil

## Objetivo
Garantir que nenhuma mensagem técnica em inglês seja exibida ao usuário, começando pelos fluxos de acesso e criação de usuários e cobrindo os demais avisos visíveis do aplicativo.

## Alterações
- Criar uma função central para converter erros conhecidos de autenticação e do banco em mensagens claras em português do Brasil.
- Incluir traduções específicas para senha fraca, credenciais inválidas, e-mail já cadastrado, limite de tentativas, sessão expirada, falta de permissão e falhas de conexão.
- Para erros desconhecidos, nunca mostrar o texto técnico original: exibir uma mensagem genérica em português, preservando o erro original apenas para diagnóstico interno.
- Aplicar essa função no acesso e criação de conta, inclusive no caso de senha recusada pelas regras de segurança.
- Aplicar a mesma proteção no gerenciamento de usuários e nos demais pontos do aplicativo que hoje enviam `error.message` diretamente para avisos na tela.
- Manter as validações locais já existentes em português e alinhar a orientação de senha da tela às exigências efetivas do cadastro.

## Validação
- Simular cadastro com senha fraca e confirmar uma orientação em português.
- Conferir login inválido, e-mail já cadastrado e falha inesperada.
- Verificar que nenhum aviso desses fluxos contém mensagem técnica em inglês.
- Confirmar que o aplicativo continua compilando sem erros.

## Detalhes técnicos
- O tradutor ficará em um módulo compartilhado e fará correspondência por código e texto normalizado do erro.
- Os pontos verificados que hoje deixam passar mensagens brutas incluem o fluxo de autenticação e ações na tela de usuários; os demais avisos diretos serão auditados no mesmo ajuste.
