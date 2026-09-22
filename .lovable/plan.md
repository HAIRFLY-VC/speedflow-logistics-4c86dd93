# Status e ações de cadastro na tela de usuários

## Tela de usuários
- Trocar a listagem atual por uma consulta administrativa que reúna nome, e-mail, data de criação, papéis e situação da conta.
- Adicionar a coluna **Status do cadastro**, exibindo claramente **E-mail confirmado** ou **Aguardando confirmação**.
- Manter a edição atual de papéis e incluir uma coluna de ações administrativas.

## Confirmar e-mail manualmente
- Exibir **Confirmar e-mail** apenas para contas ainda pendentes.
- Ao acionar, pedir confirmação e marcar o endereço como confirmado usando a administração segura do cadastro.
- Atualizar a linha imediatamente e mostrar o resultado em português.

## Excluir usuário
- Adicionar **Excluir usuário** com uma confirmação explícita que mostre nome e e-mail.
- Impedir que o administrador exclua a própria conta enquanto estiver conectado.
- Excluir a conta pela administração segura do cadastro; os vínculos dependentes configurados para acompanhar a conta serão tratados pelo banco, e qualquer bloqueio será informado em português sem deixar a tela inconsistente.

## Segurança e validação
- Todas as três operações — listar dados de cadastro, confirmar e excluir — exigirão sessão válida e papel de administrador verificado no servidor.
- Nunca enviar credenciais administrativas ao navegador.
- Atualizar a listagem após cada ação e validar a tela, os estados pendente/confirmado, as caixas de confirmação e a compilação.
