## Filtrar agenda pública para mostrar apenas a rodada atual

Na aba **Confrontos** da página pública (`/p/:tournamentId`), atualmente alguns agendamentos de rodadas antigas continuam aparecendo — especialmente os sem data/horário definido e W.O., que caem no bloco "A definir" e nunca somem.

### Comportamento desejado
- Mostrar **apenas** agendamentos pertencentes à rodada atual (a maior `rodada` existente em `matchups` do torneio).
- Vale para tudo: confrontos com data futura, sem data, sem horário, W.O., observações — se não for da rodada atual, não aparece.
- Se não houver rodada atual definida (sem `matchups`), mostra "Nenhum confronto pendente para exibir."

### Implementação
Arquivo: `src/components/public/PublicSchedule.tsx`

O componente já calcula `currentRound` e `currentRoundPairs` (Set com chaves `player1_id|player2_id` ordenadas da rodada atual), mas **não usa** essa informação no filtro. Ajustar `filteredSchedules` para:

1. Se `currentRound == null` ou `currentRoundPairs == null` → retornar `[]`.
2. Manter cada schedule somente se a chave `[s.player1_id, s.player2_id].sort().join("|")` estiver em `currentRoundPairs`.
3. **Remover** o filtro atual que esconde datas passadas (`s.data_partida < today`) — passa a ser irrelevante, pois a rodada atual já delimita o escopo, e jogos "A definir"/W.O. da rodada atual devem continuar visíveis mesmo se a data já passou.

Nenhuma mudança em banco, parsers, admin ou outras abas públicas.
