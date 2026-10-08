# Vincular tabela de frete à transportadora na tela de provisionamento

## Contexto
No modal "Provisionar frete da transportadora" (tela Autorizar pagamento de frete), quando a transportadora da rota não tem tabela de frete vigente, o cálculo fica bloqueado ("Transportadora sem tabela de frete vigente.") e o usuário precisa sair da tela e ir até "Tabelas de frete" para fazer o vínculo.

## O que será feito

### 1. Vínculo direto no modal de provisionamento (`src/components/routes/ProvisaoFreteDialog.tsx`)
- Quando o cálculo retornar o bloqueio "Transportadora sem tabela de frete vigente" (transportadora identificada, mas sem tabela), o modal passa a exibir:
  - Um seletor com as tabelas de frete **ativas** já cadastradas (nome + vigência + transportadora principal).
  - Botão **"Vincular tabela à transportadora"**.
- Ao confirmar, o app grava o vínculo na tabela de relacionamento `tabelas_preco_frete_transportadoras` (tabela_id + transportadora_id), sem alterar a transportadora principal da tabela.
- Após vincular, o cálculo do provisionamento é refeito automaticamente e o modal já mostra os valores de frete.
- Regra mantida: se a transportadora já tiver outra tabela vigente no mesmo período, o app avisa e não permite o vínculo duplicado (mesma regra da tela Tabelas de frete).

### 2. Caso "Transportadora da rota não encontrada no cadastro"
- Esse bloqueio (da imagem) significa que a rota não tem transportadora identificada no cadastro — nesse caso o vínculo não é possível e o modal continuará apenas informando o motivo. Se quiser tratar esse caso também (ex.: escolher a transportadora na hora), me avise.

## Classificação
- **MINOR** — nova funcionalidade compatível (vínculo N:N já existe; apenas nova entrada pela tela de autorização).
- Versão proposta: **1.24.4** (ou próxima disponível), com entrada no CHANGELOG.md.

## Riscos
- Banco: apenas INSERT em `tabelas_preco_frete_transportadoras` (tabela já existente, retrocompatível). Sem migração.
- Reversão: excluir o vínculo pela tela "Tabelas de frete" ou voltar a versão anterior no histórico.

## Detalhes técnicos
- O bloqueio "sem tabela vigente" hoje é só texto em `bloqueios`; o servidor (`src/lib/provisao-frete.server.ts`) passará a informar também o `transportadora_id` para o modal saber quando oferecer o vínculo.
- O seletor lista tabelas ativas de `tabelas_preco_frete`; o insert usa o cliente central com RLS (mesmo padrão da tela Tabelas de frete).
- Invalidação das queries `provisao-frete` e `tabelas-frete-vinculos` após vincular.

## Checklist para publicar
- Testar no preview: abrir o provisionamento de uma rota cuja transportadora não tem tabela, vincular uma tabela e conferir o cálculo.
- Conferir que a tabela vinculada aparece na tela "Tabelas de frete".
- Nenhuma migração de banco necessária.
- Para reverter: versão anterior no histórico do Lovable.
