# Corrigir quilometragem errada de clientes com localização "Brasil" (v1.22.1 — PATCH)

## Causa confirmada
- O cliente UBELANE FARIAS DE SOUZA ABREU (216720) foi localizado em 06/09 pesquisando apenas a palavra **"Brasil"**, porque naquele momento o endereço dele estava vazio. O Google devolveu o ponto central do país (Goiás/Mato Grosso), a cerca de 1.986 km da fábrica em Abreu e Lima.
- O pedido 4136385 não tem coordenada própria, então o app usou essa localização do cliente. Como ela parece "exata", não aparece o selo "≈ bairro/cidade".
- **98 clientes** estão na mesma situação (mesmo ponto central do Brasil).
- Outros ~200 clientes foram localizados só pelo nome do bairro, sem cidade e UF (ex.: "CENTRO", "COHAB"). Isso pode cair em outra cidade. Exemplo: o cliente 131687 ("VILA DO TRINTA") ficou no meio do oceano.

## O que muda
1. **Nunca mais localizar sem cidade e UF.** A sincronização só pesquisa um endereço quando ele tiver pelo menos cidade e UF. Assim deixa de pesquisar só "Brasil" ou só o bairro.
2. **Rejeitar respostas genéricas do Google.** Uma resposta que só identifica o país ou o estado não é gravada como localização do cliente.
3. **Ignorar localizações ruins já gravadas.** Nas telas (Pedidos sem rota, detalhe da rota, distância das rotas), o app descarta a localização do cliente quando:
   - ela foi pesquisada sem cidade/UF; ou
   - ela fica fora da UF do cliente ou longe demais da cidade dele.
   Nesses casos, o app usa o bairro ou a cidade, com o selo "≈". O cliente 216720 passa a mostrar a distância até Matinha, Abreu e Lima (alguns km).
4. **Refazer as localizações ruins.** Esses ~300 clientes entram com prioridade na fila de localização do Sync ERP, agora usando bairro, cidade e UF.
5. **Recalcular a distância das rotas** que tiverem algum desses clientes, para a coluna "Distância (km)" ficar certa.

## Detalhes técnicos
- `erp-sync.server.ts`: exigir CIDADE+UF ao montar o endereço; descartar resultados com `types` só `country`/`administrative_area_level_1` ou `partial_match` sem localidade; priorizar a regeocodificação de registros de `customer_geo` cujo `endereco_usado` não tenha vírgula.
- `order-coords.ts` / `route-stops.ts` / `pedidos-sem-rota.tsx`: validar a coordenada do cliente contra o centroide de bairro/cidade (`geo_localidades`); se a distância for maior que um limite razoável (ex.: 50 km), tratar como não localizado e usar a aproximação.
- Limpar `routes.total_distance_km` das rotas afetadas para recálculo automático.
- Sem migração de estrutura. A limpeza das ~300 localizações ruins e das distâncias afetadas é uma atualização de dados no banco compartilhado (vale para teste e oficial); reversão não é necessária, pois são dados errados que serão recalculados.
- Atualizar `version.ts` para 1.22.1 e o CHANGELOG.

## Checklist para publicar
- Em "Pedidos sem rota", conferir o cliente 216720: distância baixa com selo "≈ bairro".
- Conferir o cliente 131687 e uma rota com clientes afetados.
- Rodar o Sync ERP e ver os clientes ganharem localização correta.
- Flags: nenhuma. Reverter: voltar para a v1.22.0 no histórico.
