# Plano: número de rodadas e cálculo automático

## 1. Banco de dados
- Migration: adicionar coluna `numero_rodadas integer` (nullable) em `tournaments`.
- Após aprovação, atualizar o torneio em andamento via insert tool: `UPDATE tournaments SET numero_rodadas = 7 WHERE ...` (identificar o torneio ativo — provavelmente único existente; se houver mais de um, usar o mais recente por `data_inicio`).

## 2. Criação de torneio (Dashboard.tsx)
- Adicionar campo "Número de rodadas (Fase de Grupos)" no formulário de novo torneio (input numérico, mínimo 1, opcional mas recomendado).
- Salvar `numero_rodadas` no insert.

## 3. Helper de cálculo (`src/lib/rounds.ts`)
- Função `computeCurrentRound(matchups, results, numeroRodadas)` retornando:
  - `totalRounds`: `numero_rodadas` do torneio
  - `roundsState`: para cada rodada 1..N → `{ rodada, totalJogos, jogosConcluidos, isComplete }`
  - `currentRound`: menor rodada não concluída (ou N se todas concluídas)
  - `phaseComplete`: true quando todas as rodadas estão concluídas
- Critério "jogo concluído": existem 2 linhas em `match_results` para o par de jogadores naquela rodada (uma por jogador).

## 4. Aplicação na UI
- **ScheduleTab.tsx** (admin) e **PublicSchedule.tsx**: exibir badge "Rodada X de N" no cabeçalho, e usar `currentRound` calculado em vez de `max(rodada)`.
- **PublicTournament.tsx**: indicador de progresso da fase ("Rodada X de N").
- **StandingsTab.tsx**: quando `phaseComplete === true`, mostrar aviso sugerindo encerrar a Fase de Grupos (botão que atualiza `phase_status`).

## 5. Tarefa adicional solicitada
- Registrar `numero_rodadas = 7` no torneio que já está em andamento (via insert tool após a migration).

## Detalhes técnicos
- `numero_rodadas` é nullable para não quebrar torneios antigos; quando ausente, a UI cai no comportamento atual (`max(rodada)`).
- Sem alterações em parsers, RLS ou edge functions.
- Sem mudança em `types.ts` manual — será regenerado automaticamente após a migration.
