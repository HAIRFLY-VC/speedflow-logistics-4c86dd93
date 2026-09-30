# Ordenar filtros de UF, Cidade e Bairro por descrição ou distância

**Classificação: MINOR (v1.12.0)** — funcionalidade nova, compatível, sem mudança de banco.

## O que muda para o usuário

Na tela **Pedidos sem rota**, os filtros suspensos **Estado**, **Cidade** e **Bairro** ganham um seletor de ordenação no topo da lista:

- **A–Z** (padrão, como hoje): ordem alfabética pela descrição.
- **Distância**: ordena do mais próximo ao mais distante do nosso depósito, usando a mesma quilometragem já calculada para os grupos da tela (endereço exato, ou aproximação por bairro/cidade via Google Maps).

Quando a ordenação for por distância, cada item da lista passa a exibir também a quilometragem (ex.: `RECIFE — 12 km`), junto dos totais já exibidos (pedidos, peso, valor). Itens sem distância calculada ficam no fim da lista.

Os filtros **Agenda** e **Filial** não têm distância e continuam só em ordem alfabética.

## Como será feito (detalhes técnicos)

1. `src/components/pedidos-sem-rota/MultiFiltro.tsx`
   - `OpcaoFiltro` ganha campo opcional `distanciaKm?: number | null`.
   - Nova prop opcional `permiteOrdenarDistancia?: boolean`.
   - Quando ativa, o cabeçalho do popover mostra um alternador compacto "A–Z | km" (estado local, padrão A–Z); ao ordenar por distância, exibe o km de cada item na linha de totais.
2. `src/routes/_authenticated/pedidos-sem-rota.tsx`
   - Extrair os mapas de distância (`distUf`, `distCidade`, `distBairro`) já calculados na ordenação dos grupos para um `useMemo` reutilizável.
   - Em `agrupar()`, preencher `distanciaKm` de cada opção consultando o mapa correspondente (menor distância do grupo, mesma regra da listagem principal).
   - Passar `permiteOrdenarDistancia` apenas para Estado, Cidade e Bairro.
3. Versionamento: `src/config/version.ts` → 1.12.0 e entrada no `CHANGELOG.md`.

## Riscos

- Nenhum risco ao banco de dados: nenhuma migração, nenhuma gravação.
- Reaproveita as distâncias já calculadas na tela; não gera novas consultas ao Google Maps.
- Flags: nenhuma (pela política, nasce ativa nos dois ambientes).

## Checklist para publicar

- Testar no preview: abrir os filtros Estado/Cidade/Bairro, alternar entre "A–Z" e "km" e conferir a ordem e as distâncias exibidas.
- Confirmar que seleção múltipla, "Limpar" e os demais filtros (Agenda, Filial) seguem funcionando.
- Migrações: nenhuma. Flags: nenhuma.
- Reversão: restaurar a v1.11.3 pelo histórico do Lovable.
