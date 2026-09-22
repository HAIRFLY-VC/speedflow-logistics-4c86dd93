# Atualizar o nome da rota vindo do ERP

## Problema

O nome exibido na tela "Rotas Pendentes" (ex.: rota ID 420, "M- RB LOG") é guardado no campo de observação da rota, no formato `Rota <NOME>`. Na sincronização com o ERP, esse texto é preservado do registro anterior para não perder anotações manuais. Resultado: quando o nome da rota muda no ERP, a tela continua mostrando o nome antigo.

Isso acontece nos dois caminhos da sincronização:
- rota pendente recriada — reaproveita a observação salva antes;
- rota já existente — a atualização grava motorista, data e situação, mas não o nome.

## Correção

Passar a atualizar o nome sempre que ele vier do ERP, sem perder anotações escritas por uma pessoa:

- Se a observação atual for apenas o nome automático (`Rota <algo>`), ela é regravada com o nome atual do ERP.
- Se a observação tiver texto escrito manualmente (diferente do padrão automático), ela é mantida como está.
- No caminho de rota já existente, incluir a observação na atualização, seguindo a mesma regra.

Depois da correção, a rota 420 passa a exibir o nome atual assim que "Atualizar rotas" for acionado.

## Detalhes técnicos

`src/lib/erp-sync.server.ts`:
- Helper `notesDoNome(snapNotes, nome)`: devolve `Rota ${nome}` quando `snapNotes` é nulo ou casa com `/^Rota\s/`; caso contrário devolve `snapNotes`.
- Linha ~932 (`insertByCode`): `notes: notesDoNome(snap?.notes ?? null, p.nome)` no lugar de `snap?.notes ?? \`Rota ${p.nome}\``.
- Bloco `existingId` (~899): acrescentar `notes` ao `update`, usando a mesma regra a partir do snapshot correspondente (`snapshotByErpId` / `snapshotByCode`); quando não houver snapshot, gravar `Rota ${p.nome}`.

Sem mudanças de banco e sem alteração na tela.
