# Validar provisionamento de frete no preview (v1.24.1)

## Contexto
Estrutura Oracle criada (`GKS.SEQ_PROVISAO_FRETE` + `GKS.A_GER_PROVISAO_FRETE`) e endpoints `insert_provisao_frete` / `update_status_provisao` cadastrados na API do ERP. Falta testar o fluxo completo.

## Passos
1. **Teste no preview:** abrir "Autorizar pagamento de frete", escolher uma rota de transportadora (tipo T) com tabela de frete vigente, abrir o modal de provisionamento (lápis) e conferir o cálculo por nota fiscal.
2. **Gravar:** clicar em "Gravar provisionamento no ERP" e confirmar que o app busca o ID na sequência e grava cada nota.
3. **Conferir no ERP:** verificar as linhas em `GKS.A_GER_PROVISAO_FRETE` (IDs da sequência, valores, memória de cálculo em JSON) e o status "Confirmado" na tela.
4. **Reprovisionamento:** gravar de novo a mesma rota e conferir que as linhas antigas ficam com status 'S' e as novas com 'A'.

## Riscos
- Nenhum para a versão publicada: funcionalidade nova, ainda não usada em produção.
- O teste grava dados reais no ERP — usar uma rota de teste ou uma rota real pequena, ciente de que as linhas ficam na tabela.

## Checklist para publicar
- Testar os 4 passos acima no preview.
- Nenhuma migração no banco do app; nenhuma flag pendente.
- Reverter: versão anterior no histórico do Lovable + `DROP TABLE GKS.A_GER_PROVISAO_FRETE` / `DROP SEQUENCE GKS.SEQ_PROVISAO_FRETE` (opcional).
