# Resolver erro "GitHub installation access required" ao conectar Lovable

## Objetivo
Conectar o projeto Lovable ao repositório `SpeedFlow-Logistics` no GitHub, corrigindo o erro de permissão de instalação do app Lovable.

## Diagnóstico do erro
A mensagem indica que a conta do GitHub autenticada no Lovable não consegue gerenciar a instalação do app Lovable no repositório/organização. Isso ocorre quando:
- O repositório pertence a uma organização onde o app Lovable foi instalado por outra conta.
- A conta do GitHub logada no Lovable não é dona do repositório ou não tem permissão de admin sobre a instalação do app.
- O app Lovable ainda não foi instalado na conta/organização correta.

## Passo a passo para corrigir

1. **Verificar a conta do GitHub autenticada no Lovable**
   - No menu **+** → **GitHub**, observe qual usuário/organização aparece no canto superior da tela de seleção.
   - Se aparecer a conta pessoal, mas o repositório `SpeedFlow-Logistics` está em uma organização, será necessário alternar para a organização.

2. **Confirmar onde o repositório está**
   - Abrir https://github.com/SpeedFlow-Logistics e verificar se redireciona para `github.com/<usuario>/SpeedFlow-Logistics` ou `github.com/<organizacao>/SpeedFlow-Logistics`.
   - Anotar o nome exato do dono (usuário ou organização).

3. **Instalar/autorizar o app Lovable na conta/organização correta**
   - Se o dono for uma **organização**:
     - Acessar GitHub → Settings → Applications → Authorized OAuth Apps (ou GitHub Apps).
     - Localizar o app Lovable e verificar se a organização está listada nas instalações.
     - Se não estiver, clicar em **Configure** no app Lovable e instalar na organização. Isso pode exigir permissão de administrador da organização.
   - Se o dono for uma **conta pessoal**:
     - Revogar a autorização do app Lovable em GitHub → Settings → Applications → Authorized OAuth Apps.
     - Voltar ao Lovable e refazer o fluxo **+** → **GitHub** → **Connect project**, autorizando novamente.

4. **Reconectar pelo Lovable com a conta correta**
   - No menu **+** → **GitHub**, clicar em **Connect project** (ou em uma opção de trocar conta/reconectar, se disponível).
   - Na tela do GitHub, selecionar o usuário ou organização correto.
   - Selecionar o repositório `SpeedFlow-Logistics`.
   - Confirmar para o Lovable fazer o push inicial.

5. **Se o repositório for de uma organização e você não for admin**
   - Pedir a um administrador da organização para instalar o app Lovable na organização.
   - Após a instalação, refazer o passo 4.

## Validação
- Após a conexão, aguardar alguns segundos até o Lovable indicar "Connected".
- Abrir o repositório no GitHub e verificar se os arquivos e commits do projeto apareceram.
