# Pré-seleção da transportadora no modal de edição da rota

## O problema

A tela de rotas já resolve, para cada rota, o código do responsável em duas fontes: o `COD_FRT_TRP`
lido direto do ERP e, como reserva, o código da transportadora cadastrada localmente
(`codResponsavelPorRota`). Mas o modal de edição não recebe esse valor: ele recebe apenas o código da
transportadora local (`transpPorRota.get(r.id)?.cod_erp`). Quando a rota tem responsável no ERP e
nenhuma transportadora local com aquele código, o modal abre com "Selecione o responsável" — exatamente
o caso da rota 356 do print.

Há um segundo ponto: mesmo com o código em mãos, o combo só mostra o item selecionado quando o código
existe na lista carregada do ERP (que só traz naturezas EF/ET/EM). Fora disso o campo fica em branco.

## Correção

1. Ao abrir o modal (clique na linha e no botão de edição), passar como código inicial o mesmo valor
   já resolvido na listagem (`codResponsavelPorRota`), com o cadastro local só como reserva.
2. Passar também o responsável já resolvido (razão social + tipo) para o modal, vindo do espelho local
   `erp_responsaveis` / da lista do ERP.
3. No modal, exibir esse responsável como selecionado quando o código não estiver na lista carregada,
   em vez de "Carregando responsável…"/vazio. Se ele não estiver na lista do dropdown, incluí-lo como
   primeira opção para que a seleção seja visível e preservada ao salvar.
4. Manter os fallbacks atuais (código sem zeros à esquerda e casamento por razão social).

## Detalhes técnicos

- `src/routes/_authenticated/rotas.index.tsx`: nos dois pontos que abrem o diálogo (linhas ~1055 e
  ~1182) trocar `setEditCodErp(transpPorRota.get(r.id)?.cod_erp ?? null)` por
  `setEditCodErp(codResponsavelPorRota.get(r.id) ?? transpPorRota.get(r.id)?.cod_erp ?? null)` e
  guardar `responsavelPorRota.get(r.id)` em novo estado `editResponsavel`, repassado ao
  `RouteEditDialog` como prop opcional `initialResponsavel`.
- `src/components/routes/RouteEditDialog.tsx`:
  - nova prop `initialResponsavel?: ResponsavelErp | null`;
  - `selected` passa a ser `responsaveis.find(codErp === codFrtTrp)` ou, na ausência,
    `initialResponsavel` quando `normalizaCod` bater com `codFrtTrp`;
  - a lista do `Command` recebe esse responsável extra no topo quando ele não estiver em `responsaveis`;
  - o `salvar` usa o mesmo resolvedor para `nomeMotorista`, evitando gravar `null` quando o responsável
    não está na lista do ERP.
- Sem mudanças de banco ou de backend.
