# Conectar projeto ao novo repositório GitHub SpeedFlow-Logistics

## Objetivo
Conectar o projeto atual ao repositório `SpeedFlow-Logistics` no GitHub, já que hoje o menu mostra apenas a opção "Conectar" (sem vínculo ativo).

## Passo a passo

1. **Verificar vínculo da conta GitHub com o workspace Lovable**
   - Abrir o menu **+** (canto inferior esquerdo do chat) → **GitHub**.
   - Se a tela mostrar "Connect project", significa que não há repositório vinculado.
   - Se pedir login/autorização do GitHub, prosseguir com a conta desejada.

2. **Criar o repositório destino no GitHub (se ainda não existir)**
   - Acessar https://github.com/new.
   - Nome: `SpeedFlow-Logistics`.
   - Escolher a conta/organização correta.
   - Deixar público ou privado conforme preferência.
   - **Não** inicializar com README, .gitignore ou licença (o Lovable fará o push inicial).
   - Criar o repositório.

3. **Iniciar a conexão pelo Lovable**
   - No menu **+** → **GitHub**, clicar em **Connect project**.
   - Autorizar o aplicativo Lovable GitHub App no GitHub, se solicitado.
   - Selecionar a conta/organização onde o repositório `SpeedFlow-Logistics` foi criado.
   - Escolher o repositório `SpeedFlow-Logistics` na lista.
   - Confirmar para que o Lovable faça o push inicial do código.

4. **Verificar a sincronização**
   - Aguardar alguns segundos até que o Lovable indique que está conectado.
   - No GitHub, abrir o repositório `SpeedFlow-Logistics` e confirmar que os arquivos do projeto e o histórico de commits apareceram.
   - A partir daí, qualquer alteração no Lovable será enviada automaticamente para o GitHub (e vice-versa, se houver push externo).

## Em caso de erro

- Se aparecer "Já existe um repositório conectado a outro projeto Lovable", confirmar que o repositório `SpeedFlow-Logistics` está vazio/novo e não vinculado a outro projeto.
- Se houver falha de autorização, revogar o app Lovable em GitHub → Settings → Applications e refazer o passo 3.
- Se o push inicial falhar, verificar se o repositório não foi inicializado com README ou outro arquivo que cause conflito.
