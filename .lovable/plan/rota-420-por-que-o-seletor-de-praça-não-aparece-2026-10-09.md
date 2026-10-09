# Rota 420: por que o seletor de praça não aparece

## Causa
O seletor de praça só aparece quando a rota já tem uma tabela de frete vigente. Na rota 420, a RBLOG está sem tabela vigente. A tabela sugerida, "RB LOG", também está vencida: vale de 16/04/2025 a 15/07/2025. Por isso o app não tem praças para oferecer e mostra só "praça não encontrada".

## O que muda (PATCH, v1.29.3)
1. Na lista de tabelas para vincular, as vencidas passam a aparecer com o selo "vencida". Ao escolher uma, um aviso explica que ela não será usada até a data final ser estendida.
2. Na linha da entrega, o texto "praça não encontrada" muda para "sem tabela vigente" quando esse for o motivo. Assim fica claro que primeiro é preciso vincular ou atualizar a tabela.
3. Junto ao aviso, entra o atalho "Editar tabela de frete", que abre a tela Tabelas de Frete. Lá é possível ajustar a vigência (ou deixar a data final vazia).
4. Depois que a tabela fica vigente e vinculada, o seletor de praça aparece normalmente, como já acontece na rota 461.

## Riscos
Nenhuma mudança no banco. Nada muda no cálculo; só nos avisos e na navegação.

## Detalhes técnicos
- `provisao-frete.server.ts`: devolver um `motivo` por entrega ("sem_tabela" | "sem_praca") e marcar `vencida` em cada tabela listada (`data_fim < hoje`).
- `ProvisaoFreteDialog.tsx`: selo e aviso no Select de vínculo, texto do motivo e link para `/tabelas-frete`.
- Atualizar `version.ts` e `CHANGELOG.md`.

## Checklist para publicar
- Rota 420: conferir o selo "vencida" e a mensagem. Estender a vigência da RB LOG, vincular, escolher a praça de Belém e gravar.
- Sem migrações nem flags.
- Reverter: versão anterior no histórico.
