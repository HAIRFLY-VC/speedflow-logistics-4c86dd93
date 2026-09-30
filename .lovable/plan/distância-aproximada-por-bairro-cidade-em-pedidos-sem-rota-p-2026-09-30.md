# Distância aproximada por bairro/cidade em Pedidos sem rota — PATCH v1.11.2

## Situação atual (confirmada no código)

A tela **Pedidos sem rota** calcula a quilometragem em linha reta a partir do depósito, usando nesta ordem: coordenadas do pedido → coordenadas do cadastro do cliente (`customer_geo`). Quando nenhuma existe, mostra "Endereço não localizado".

A tela já carrega **todas** as coordenadas de clientes (`customer_geo`) e **todo** o espelho de clientes do ERP (`clientes_erp`, com bairro, cidade e UF). Não existe tabela de coordenadas por bairro/cidade — mas dá para derivar essas coordenadas a partir dos clientes já geocodificados.

## Alteração proposta

1. **Calcular coordenadas médias por bairro e por cidade** na própria tela, a partir dos clientes que já têm coordenadas:
   - média das coordenadas dos clientes do mesmo bairro + cidade + UF → referência do bairro;
   - média das coordenadas dos clientes da mesma cidade + UF → referência da cidade.
2. **Nova ordem de busca da distância** de cada cliente:
   1. coordenadas do pedido (endereço alternativo de entrega);
   2. coordenadas do cadastro do cliente;
   3. coordenadas médias do **bairro**;
   4. coordenadas médias da **cidade**;
   5. só então "Endereço não localizado".
3. **Sinalização quando a distância não for pelo endereço exato:**
   - distância pelo bairro: mostrar o km com um selo discreto **"≈ bairro"** (âmbar);
   - distância pela cidade: selo **"≈ cidade"** (âmbar);
   - distância exata (pedido ou cadastro): sem selo, como hoje;
   - sem nenhuma referência: mantém "Endereço não localizado".
4. Manter a ordenação hierárquica atual (UF → cidade → bairro → cliente) e o agrupamento por cliente.
5. Nenhuma chamada nova ao ERP, nenhuma geocodificação nova, nenhuma migração de banco: tudo calculado com dados que a tela já carrega.

## Versão, risco e publicação

- **Versão:** PATCH `1.11.2` (atualizar `src/config/version.ts` e `CHANGELOG.md`).
- **Banco compartilhado:** nenhuma migração e nenhuma gravação.
- **Integrações:** nenhuma chamada adicional.
- **Flag:** não necessária; segue para a oficial ao publicar, conforme a política do projeto.

## Checklist para publicar

- No preview, conferir clientes que antes mostravam "—" e agora exibem km com selo "≈ bairro" ou "≈ cidade".
- Confirmar que clientes com endereço localizado continuam sem selo.
- Confirmar que filtros, seleção e atribuição de rota continuam funcionando.
- Migrações aplicadas: nenhuma.
- Flags a ligar: nenhuma.
- Reversão: restaurar a versão `1.11.1` pelo histórico do Lovable; não há SQL de reversão.
