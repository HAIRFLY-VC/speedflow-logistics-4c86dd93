# Exibir a razão social do destinatário no CT-e

## O que está acontecendo

No CT-e 16238 o destinatário é o CNPJ 69952844000139. Verifiquei o banco: esse CNPJ não existe em clientes, empresas nem transportadoras, e também não há NF-e importada com ele. Como a tela busca o nome apenas nessas tabelas, ela não encontra nada e o campo fica vazio.

O nome está no próprio XML do CT-e (bloco `dest` → `xNome`), mas hoje o app só guarda o CNPJ do destinatário — o nome é descartado na importação.

## Correção

1. Guardar o nome do destinatário vindo do XML em uma nova coluna `nome_destinatario` na tabela de CT-e.
2. Passar a extrair esse nome na importação (mesma lógica já usada para o emitente).
3. Preencher os CT-e já importados lendo o XML salvo no armazenamento (rotina única de backfill, sem precisar reimportar tudo).
4. Na tela de detalhes, usar esse nome como fonte principal e manter a busca em NF-e / clientes / empresas / transportadoras apenas como alternativa.

## Detalhes técnicos

- Migração: `ALTER TABLE public.ctes ADD COLUMN nome_destinatario text`.
- `src/lib/cte-parse.server.ts`: extrair `xNome` da seção `dest` e incluir no retorno tipado.
- `src/lib/cte-ingest.server.ts`: gravar o campo no insert/upsert.
- Backfill: server function que percorre os CT-e com `nome_destinatario` nulo e `xml_storage_path` preenchido, baixa o XML do bucket `cte-xml`, reaproveita o parser e atualiza a linha.
- `src/components/ctes/CteDetailDialog.tsx`: `hint={cte.nome_destinatario ?? nomeDestinatario ?? undefined}`, mantendo a query atual como fallback.
