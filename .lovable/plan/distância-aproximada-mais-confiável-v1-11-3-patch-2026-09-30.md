# Distância aproximada mais confiável (v1.11.3 — PATCH)

## Problema
Quando o endereço exato não é encontrado, o app calcula a distância usando a **média das coordenadas de outros clientes** do mesmo bairro ou cidade. Se um desses clientes tiver a localização errada (por exemplo, marcado em outro estado), a média fica muito longe. É o que aconteceu com JACIVANIO LOURENCO DE LUNA ME (197084): 1.195 km em vez de uns 13 km.

## O que muda
1. **Localizar o bairro ou a cidade no Google Maps**: quando faltar o endereço exato, o app pergunta ao Google Maps onde fica "bairro, cidade, UF" (ou "cidade, UF"). Essa é a referência principal.
2. **Guardar as respostas**: cada bairro ou cidade é consultado uma vez só e fica guardado. Assim a tela continua rápida e o custo do Google fica baixo.
3. **Reserva mais segura**: se o Google Maps não responder, o app usa os clientes vizinhos, mas agora pega o **ponto do meio** (mediana) e descarta coordenadas fora do estado ou muito distantes das outras. Um cadastro errado deixa de estragar o cálculo.
4. **Trava de segurança**: uma distância aproximada fora do razoável para a UF é descartada e aparece "Endereço não localizado", em vez de mostrar um número errado.
5. Os selos "≈ bairro" e "≈ cidade" continuam aparecendo.

## Detalhes técnicos
- Conectar o Google Maps (gerenciado pelo Lovable). A consulta de localização é feita no servidor e só por usuários logados, com no máximo 50 localidades novas por abertura de tela e 5 consultas ao mesmo tempo.
- Nova tabela `speedflow.geo_localidades` (uf, cidade, bairro, lat, lng, fonte, atualizado_em) para guardar as respostas. É só um acréscimo e não quebra a versão publicada. Para desfazer: `drop table speedflow.geo_localidades`.
- Em `pedidos-sem-rota.tsx`: ordem pedido → cliente → localidade guardada/Google → mediana dos vizinhos sem os pontos fora do padrão.
- Atualizar version.ts e CHANGELOG.

## Checklist para publicar
- Conferir o cliente 197084, que deve mostrar cerca de 13 km com o selo "≈ bairro/cidade".
- Migração: criação da tabela de localidades (banco compartilhado).
- Flags: nenhuma.
- Como reverter: voltar para a v1.11.2 e apagar a tabela.
