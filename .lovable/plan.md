# Card "Pedidos pendentes sem rota" não aparece para Gestor

## O que já foi verificado
- O card não verifica o perfil do usuário em nenhum ponto. Ele aparece para qualquer perfil que abra **Rotas Pendentes**, desde que existam pedidos sem rota.
- A consulta dos pedidos sem rota usa o mesmo caminho para Administrador e Gestor, sem filtro por perfil.
- Hoje, se a consulta falhar ou demorar, o card simplesmente **some**, sem nenhum aviso. Isso explica por que ele pode faltar sem nenhum erro visível.

A causa exata ainda **não foi confirmada**. As hipóteses mais prováveis são:
1. O Gestor está usando a versão oficial (publicada), que pode estar desatualizada em relação ao teste.
2. A consulta falha ou estoura o tempo na sessão do Gestor, e o card fica escondido.

## Passos
1. **Diagnóstico:** entrar como um usuário Gestor no preview, abrir Rotas Pendentes e registrar a resposta da consulta dos pedidos sem rota (sucesso, erro ou demora). Comparar com a versão publicada.
2. **Correção, conforme o diagnóstico:**
   - Se for versão desatualizada: nenhuma mudança de código. Basta publicar.
   - Se for falha na consulta: corrigir a causa. Além disso, mostrar o card em estado "carregando" e, em caso de erro, uma mensagem discreta com a opção "Tentar novamente", em vez de escondê-lo.
3. Validar com Gestor e Administrador que os totais do card coincidem com a tela **Pedidos sem rota**.

## Versão
- PATCH: 1.16.1 para 1.16.2, com entrada no CHANGELOG (só se houver mudança de código).

## Risco e reversão
- Risco baixo: só leitura e exibição. Sem mudança no banco e sem chamadas ao ERP.
- Para desfazer: voltar para a versão anterior no histórico.

## Checklist para publicar
- Como Gestor, conferir que o card aparece e pulsa quando há pedidos sem rota.
- Migrações: nenhuma. Opções para ligar: nenhuma.
