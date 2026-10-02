# Atualizar a distância da rota pelo mapa

**Classificação:** PATCH — versão proposta `1.16.14`.

## Alterações
- Usar a distância calculada no mapa do detalhe da rota como a fonte do campo **Distância (km)**.
- Ao concluir o cálculo do mapa, gravar a quilometragem na própria rota e atualizar imediatamente as consultas da listagem.
- Considerar exatamente os mesmos pontos usados no mapa, inclusive localização do cadastro do cliente e aproximações por bairro/cidade.
- Evitar gravações repetidas quando o valor calculado não tiver mudança relevante.
- Manter o botão de recálculo da coluna para rotas cujo detalhe ainda não tenha sido aberto.
- Atualizar a versão para `1.16.14` e registrar a correção no changelog.

## Validação
- Abrir o detalhe de uma rota e comparar a quilometragem mostrada sobre o mapa com a coluna **Distância (km)** em Rotas Pendentes.
- Confirmar que a coluna é atualizada após o cálculo, sem necessidade de Sync ERP.
- Conferir uma rota com localização aproximada por bairro/cidade e outra com coordenadas exatas.
- Validar que falha no serviço de mapas não apaga a distância já armazenada.

## Impacto e publicação
- **Banco compartilhado:** sem migração estrutural; apenas o campo de distância da rota será atualizado pelo cálculo já exibido no mapa.
- **Integrações:** usa a consulta atual ao Google Maps, sem chamadas adicionais além do cálculo que o detalhe já executa.
- **Flag:** não necessária; é correção do comportamento existente e seguirá ativa em teste e produção.
- **Reversão:** restaurar a versão anterior pelo histórico. Os valores calculados permanecem válidos; não é necessário desfazer dados.
