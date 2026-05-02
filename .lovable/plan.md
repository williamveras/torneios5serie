## Objetivo

Simplificar a tela de Classificação (administrativa e pública) removendo a sub-aba de "Resultados por Rodada" e exibir a Classificação Geral organizada por grupos. Quando a fase não tiver grupos definidos, exibir apenas uma lista única, sem rótulo de grupo.

## Mudanças

### 1. Aba Classificação (admin) — `src/components/tournament/StandingsTab.tsx`

- Remover o componente `Tabs`/`TabsList`/`TabsContent` e a seção "Resultados por Rodada".
- Manter apenas a tabela da Classificação Geral (mesmas regras atuais: ordenação por penalidades → pontos de vitória → pontos de mesa; mesmas colunas).
- Remover o filtro "Grupo" do topo (Select de grupo) — não é mais necessário, pois os grupos serão exibidos como seções.
- Manter o filtro "Fase", o botão "Marcar/Reabrir fase" e o botão "Exportar Planilha".
- Agrupar os `standings` por `grupo`:
  - Se houver pelo menos um grupo definido (valor não vazio) nos resultados da fase selecionada: renderizar uma seção por grupo, com título "Grupo X", e dentro de cada seção a tabela de classificação daquele grupo (posições recalculadas dentro do grupo, 1º, 2º, 3º…).
  - Se nenhum resultado da fase tiver grupo (ou todos vierem vazios): renderizar uma única tabela, sem rótulo de grupo, com posições gerais.
- Ordenação dos grupos: alfanumérica natural (1, 2, …, 10, 11) — manter o `.sort()` já existente, mas com comparador numérico quando aplicável.
- Exportação XLSX:
  - Manter a coluna "Grupo" (já adicionada).
  - Quando houver grupos, gerar **uma aba por grupo** dentro do mesmo arquivo (`Grupo 1`, `Grupo 2`, …) + uma aba "Geral" com todos juntos.
  - Quando não houver grupos, gerar apenas uma aba "Classificação" sem a coluna "Grupo".
- Remover o estado `selectedGroup` e a lógica `isFaseDeGrupos` que dependia dele para o filtro.

### 2. Página pública — Classificação — `src/components/public/PublicStandings.tsx`

Aplicar exatamente a mesma lógica visual:
- Remover o Select de "Grupo".
- Quando houver grupos na fase selecionada: exibir múltiplas listas (`<ol>`), uma por grupo, cada uma com seu cabeçalho "Grupo X" (`<h3>` para acessibilidade) e posições 1º…Nº dentro do grupo. O `aria-label` da lista deve incluir o nome do grupo.
- Quando não houver grupos: exibir uma única lista, sem cabeçalho de grupo, com posições gerais.
- Manter os Alerts de "Fase em andamento" / "Fase encerrada" e o estado vazio.

### 3. Página pública — Resultados — `src/components/public/PublicResults.tsx`

O usuário pediu "tanto na parte administrativa como na exibição pública para os jogadores". A aba pública equivalente à classificação é `PublicStandings`. A aba `PublicResults` (lista de resultados por rodada) **não será alterada** — ela é informativa de cada rodada, não é classificação. Confirmar com o usuário caso esse não seja o entendimento.

### Detalhes técnicos

- Detecção de "fase sem grupos": `results.every(r => !r.grupo || r.grupo.trim() === "")` na fase filtrada. Como a coluna `grupo` é `NOT NULL`, na prática isso significa string vazia ou um marcador. Tratar string vazia como "sem grupo".
- Reaproveitar `computeStandings` em `src/lib/standings.ts` aplicando-o por subconjunto (por grupo) — não precisa mudar a função.
- Posições são recalculadas **dentro de cada grupo** (cada grupo começa do 1º).

## Arquivos afetados

- `src/components/tournament/StandingsTab.tsx` (refatorar)
- `src/components/public/PublicStandings.tsx` (refatorar)
- `src/lib/standings.ts` (sem mudança, reutilizar)

## Fora de escopo

- Nenhuma migração de banco.
- Nenhuma mudança no registro de resultados, agenda, confrontos ou exibição da aba pública "Resultados".
