
## O que o parceiro quer

Analisando os dois scripts enviados, ele consome os dados do torneio em dois formatos:

**1. `exportar_fases.py` → arquivos `.txt` de texto puro**

Para **fase de grupos** (informando N rodadas):
- Um arquivo por rodada: `rodada1.txt`, `rodada2.txt`, …
- Um arquivo consolidado: `resultados gerais.txt`
- Layout de cada arquivo:
  ```
  Segue abaixo os resultados da primeira rodada, dispostos na seguinte ordem:

  Grupo 1:
  <nome do jogador/dupla>
  <pontos de vitória>
  <pontos de mesa>
  <penalidades — só se > 0>
  <notas de penalidade — só se houver>
  ```
- Ordenação: por grupo (numérico), depois vitórias desc, mesa desc, penalidades asc, nome.

Para **fase eliminatória**:
- Um arquivo por fase: `Quartas_de_Final.txt`, etc.
- Mesmo layout, mas agrupado por **Mesa N** e com a palavra `eliminado` abaixo do jogador que zerou.

**2. `gerar_classificacao_torneio_6.py` → planilha `.xlsx` estilizada**

- Uma planilha por **rodada** (grupos) ou por **fase** (eliminatória).
- Colunas: `Nome | Grupo|Mesa | Data | Hora | Pontos de vitória | Pontos de jogo | Penalidades|Situação`.
- Cabeçalho grande mesclado na linha 1, header azul (`#1F4E78`) branco negrito, bordas finas, freeze pane, auto-filter.
- Aba extra `Avisos` com problemas encontrados (nome/data/hora/grupo vazios).
- Em fase eliminatória, quem tem 0 vitórias vira `eliminado` na coluna Situação.

## Solução proposta

Criar uma **nova aba "Exportação"** em `TournamentPage.tsx` (entre "Estatísticas" e "Regulamento"), com um único componente `ExportTab.tsx` que:

1. Lista as fases existentes no torneio (a partir de `match_results` + `useMainFases`) e identifica quais são de grupos vs. eliminatórias.
2. Para cada fase de grupos, mostra as rodadas detectadas nos resultados; usuário marca quais quer incluir.
3. Botão único **"Baixar pacote (.zip)"** que gera, do lado do cliente, um ZIP com toda a estrutura que o parceiro espera:

```text
exportacao_<torneio>.zip
├── txt/
│   ├── Fase de Grupos/
│   │   ├── rodada1.txt
│   │   ├── rodada2.txt
│   │   └── resultados gerais.txt
│   ├── Quartas de Final.txt
│   ├── Semifinal.txt
│   └── Final.txt
└── xlsx/
    ├── Fase de Grupos/
    │   ├── Rodada 1.xlsx
    │   └── Rodada 2.xlsx
    ├── Quartas de Final.xlsx
    ├── Semifinal.xlsx
    └── Final.xlsx
```

4. Botões auxiliares para baixar avulso: “Só TXT da rodada X”, “Só XLSX da fase Y” (opcional, mesma engine).

## Detalhes técnicos

- **Fonte de dados**: reutilizar `fetchAllMatchResults(tournamentId)` + `players` + `team_members` + `match_schedule` (para pegar `data_partida` e `horario` quando o `match_results` não tiver os campos preenchidos — o script do parceiro usa `date`/`time` do registro).
- **Nome do jogador**: usar o helper existente `formatPlayerWithTeam` de `src/lib/playerDisplay.ts` para respeitar a regra "dupla (membro1 e membro2)".
- **Ordenação e agregação**: replicar `aggregate_by_round` / `aggregate_general` / `player_sort_key` em TypeScript (`src/lib/exportPartner.ts`). Somar `pontos_jogo`, `pontos_mesa`, `penalidades` por jogador e concatenar `comentario`/notas de penalidade.
- **Mesa em fases eliminatórias**: derivar de `matchups.mesa` / `match_schedule.mesa` (mesma lógica que `PublicStandings` já faz para o título "mesa X").
- **TXT**: string builder puro, encoding UTF-8, quebra `\n`, exatamente no formato do `render_text`.
- **XLSX**: usar `xlsx` (já instalado). Como `xlsx` community não faz merge/estilos ricos, adicionar **`xlsx-js-style`** (fork drop-in) para reproduzir:
  - merge da linha 1 (cabeçalho grande),
  - fill `#1F4E78` + fonte branca negrito no header,
  - bordas finas `#D9E2F3`,
  - `!freeze` A3, `!autofilter` A2:G{n},
  - largura de coluna auto (`min(max(len+2,12),45)`).
- **ZIP**: adicionar **`jszip`** e disparar download com um blob URL (`<a download>`).
- **Sem backend novo**: tudo client-side; nenhuma edge function, nenhuma migração.
- **Sem mudanças de RLS**: leitura já é permitida para membros da organização.

## Arquivos afetados

- **Novo** `src/lib/exportPartner.ts` — agregação, ordenação, geração de TXT e XLSX (funções puras, testáveis).
- **Novo** `src/components/tournament/ExportTab.tsx` — UI da aba (seleção de fases/rodadas, botão de download, feedback com `sonner`).
- **Editado** `src/components/TournamentPage.tsx` — adiciona `<TabsTrigger value="export">Exportação</TabsTrigger>` e `<TabsContent>` correspondente.
- **Dependências novas**: `jszip`, `xlsx-js-style`.

## Perguntas rápidas antes de implementar

1. Quer que eu inclua as **fases eliminatórias** no mesmo ZIP por padrão, ou só a fase de grupos (que é o foco dos dois scripts)?
2. No TXT, o script do parceiro usa "pontos de mesa"; no nosso schema é `pontos_mesa`. Confirma que é isso mesmo que ele espera na segunda linha de cada jogador?
3. Para a coluna **Data/Hora** do XLSX, quando um jogo tiver `data_partida/horario` vazios em `match_results`, posso **cair de volta** no `match_schedule` do confronto correspondente (ou prefere deixar em branco, como o script original faz)?
