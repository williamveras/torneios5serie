## Objetivo
Permitir torneios em que **quem faz menos pontos de mesa vence**, garantindo que toda a classificação, desempates e o importador de resultados respeitem essa regra.

## Mudanças

### 1. Banco — novo campo no torneio
Migração adicionando `lower_score_wins boolean NOT NULL DEFAULT false` em `public.tournaments`.

### 2. Configurações do torneio (`TournamentSettingsDialog.tsx`)
Adicionar um seletor logo abaixo de "Modalidade":

**Regra de pontuação de mesa**
- *Maior pontuação vence* (padrão)
- *Menor pontuação vence*

Salvar junto com os demais campos. Carregar valor existente ao abrir.

### 3. Cálculo de classificação
Propagar uma flag `lowerWins` para:

- **`src/lib/standings.ts`** — `computeStandings` passa a receber `lowerWins`. Critérios:
  - 1º: maior `pontos_jogo` (pontos de vitória continuam sempre "quanto mais melhor", pois são 3/0).
  - 2º: `pontos_mesa` ordenado conforme `lowerWins` (asc se menor vence, desc caso contrário).
  - H2H: vencedor continua sendo determinado por `pontos_jogo` (já correto).
- **`src/lib/qualifiers.ts`** — mesmo ajuste no comparador.
- **`src/components/public/PublicStandings.tsx`** — buscar `lower_score_wins` do torneio; usar nos blocos de inferência de vencedor por H2H e passar a flag para `computeStandings`. Inverter também as comparações em qualifiers que olham `pontos_mesa`.
- **`src/components/tournament/StandingsTab.tsx`** — idem para todos os blocos que decidem vencedor/perdedor por `pontos_mesa`.

### 4. Registro manual de resultados (`ResultsTab.tsx`)
Carregar `lower_score_wins` do torneio para exibir uma dica visual abaixo do campo "Pontos de Mesa" quando aplicável.

Sem alteração na gravação — o operador continua informando os pontos de vitória explicitamente (3 para o vencedor, 0 para o perdedor).

### 5. Importador por texto (`resultsParser.ts` + `ImportResultsDialog.tsx`)
- `parseResultsText` passa a aceitar opção `{ lowerWins: boolean }`.
- Quando não houver linha indicando o vencedor, o vencedor automático passa a ser o de **menor** pontuação se `lowerWins=true` (hoje é sempre o de maior).
- Quando houver linha explícita de vencedor, respeita o texto.
- `ImportResultsDialog` busca `lower_score_wins` do torneio ao abrir e repassa para o parser. Mostra um aviso no cabeçalho do diálogo quando a regra estiver ativa.

### 6. Visualização pública de resultados (`PublicResults.tsx`)
A marcação de vencedor já usa `pontos_jogo` (3/0), que segue correto independentemente da direção da pontuação de mesa. **Sem alteração nesta parte.**

## Notas
- Padrão `false` mantém o comportamento atual para todos os torneios existentes.
- Pontos de vitória (`pontos_jogo`) continuam sendo a métrica primária; apenas o **desempate por pontos de mesa** e o **vencedor inferido pelo importador** mudam de direção.
