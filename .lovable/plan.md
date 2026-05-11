## Modificações na aba de Registro de Resultados e Classificação

### 1. Auto-preenchimento ao selecionar o jogador (eliminado por W.O)

No componente `ResultsTab.tsx`, ao escolher o **jogador** no campo de seleção:

- O sistema irá consultar os registros anteriores desse jogador em `match_results` (no torneio atual).
- Se houver **qualquer registro** com penalidade `"Eliminado por W.O"`, o sistema entende que ele já está eliminado e preenche automaticamente:
  - **Pontos de Vitória = 0**
  - **Pontos de Mesa = 0**
  - **Penalidade = "Eliminado por W.O"**
  - **Grupo** (se for Fase de Grupos), a partir do `grupo` do jogador
- Se não houver esse registro prévio, o comportamento atual é mantido (apenas o grupo é auto-preenchido como hoje).
- Os campos continuam editáveis caso seja necessário ajustar manualmente.

A consulta será feita na hora da seleção (uma chamada simples ao Supabase filtrando por `tournament_id`, `player_id` e `penalidades = 'Eliminado por W.O'`).

### 2. Exibição consolidada da penalidade na Classificação

No `src/lib/standings.ts`, ajustar a agregação de penalidades:

- Se o jogador tiver qualquer ocorrência de `"Eliminado por W.O"`, a coluna exibirá **apenas** `"Eliminado por W.O"` (sem repetição, sem misturar com outras).
- Para os demais casos, manter a concatenação atual com `;`, mas removendo duplicatas para evitar `"W.O; W.O"`.

### Arquivos afetados

- `src/components/tournament/ResultsTab.tsx` — auto-preenchimento ao selecionar o jogador
- `src/lib/standings.ts` — consolidação da exibição de penalidades

Sem mudanças de banco de dados ou de regras de pontuação.
