# Corrigir vínculo Bitrix que "salva" mas não grava (Gutemberg)

## Causa provável (a confirmar no primeiro passo)
O vínculo é gravado com um "atualizar" no cadastro de perfis do banco central. Se o Gutemberg não tem linha de perfil lá (ele foi cadastrado recentemente), a atualização não altera nenhuma linha e não gera erro. Por isso a tela mostra "Vínculo salvo" e nada muda. O nome dele aparece na lista porque vem do cadastro de acesso, não do perfil.

## O que vou fazer
1. Confirmar no banco central se existe perfil para o Gutemberg.
2. Trocar a gravação por "criar ou atualizar": cria o perfil com nome e depois grava o vínculo.
3. Depois de gravar, conferir se a linha foi mesmo alterada. Se não foi, mostrar erro em vez de "Vínculo salvo".
4. Vincular o Gutemberg de novo e confirmar que o vínculo continua depois de recarregar a tela. Vale para Configurações e para Usuários.
5. Versão 1.1.3 (correção) e registro no CHANGELOG.

## Detalhes técnicos
- `salvarVinculoBitrix` em `src/lib/bitrix-config.functions.ts`: passa de `update().eq("id")` para `upsert({ id, full_name, bitrix_user_id, bitrix_user_nome }, { onConflict: "id" })` com `.select("id")`. O `full_name` vem do auth quando o perfil não existe. Se o retorno vier vazio, lança erro.
- Não há migração de banco.
