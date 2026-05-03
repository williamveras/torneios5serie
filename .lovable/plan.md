## Ajustes na página pública

### 1. Reordenar as abas da página pública
Em `src/pages/PublicTournament.tsx`, mudar a ordem dos botões e do conteúdo das abas para:
1. Resultados (passa a ser a aba padrão — `defaultValue="results"`)
2. Classificação
3. Agenda

### 2. Reformatar a aba "Resultados" como confrontos
Em `src/components/public/PublicResults.tsx`:

**Agrupamento por confronto:** cada partida gera 2 registros em `match_results` (um por jogador). Eles serão agrupados pela combinação `created_at + fase + grupo + rodada` (esse é o padrão observado nos dados — os 2 registros de uma mesma mesa são inseridos juntos e compartilham o mesmo timestamp).

**Ordenação:** confrontos exibidos do mais recente para o mais antigo (ordem em que foram postados no sistema), independentemente de fase/rodada.

**Layout de cada confronto (card):**
- Cabeçalho: data e hora da postagem (formato `dd/mm/aaaa HH:mm`), fase, e — quando "Fase de Grupos" — o número do grupo, e a rodada.
- Linha do jogador 1: nick (ou nome completo como fallback), pontos de jogo, pontos de mesa, penalidades.
- Linha do jogador 2: idem.
- Caso o confronto venha "incompleto" (apenas 1 registro com aquele timestamp), mostrar só o jogador disponível com aviso discreto "registro avulso".

**Filtro de fase:** mantido como hoje (Select no topo). O banner amarelo/verde de status da fase também é mantido.

### 3. Detalhes técnicos

- A lógica de agrupar pares vai num `useMemo` em `PublicResults.tsx` que produz uma lista de "confrontos": `{ key, created_at, fase, grupo, rodada, players: MatchResult[] }`, ordenada por `created_at` desc.
- Chave de agrupamento: `${created_at}|${fase}|${grupo}|${rodada}`.
- Não há mudanças no banco de dados nem em policies.
- A seção "Rodada N" atual será substituída por cards individuais de confronto.
- Acessibilidade: cada card vira `<article>` com `aria-label` descrevendo o confronto (ex.: "Confronto Grupo 10, Rodada 1, postado em 21/04/2026 às 14:25").

### Arquivos alterados
- `src/pages/PublicTournament.tsx` — reordenação das abas e default.
- `src/components/public/PublicResults.tsx` — nova renderização em confrontos pareados com data/hora.
