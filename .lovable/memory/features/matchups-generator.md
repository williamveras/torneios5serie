---
name: Matchups Generator
description: Aba Confrontos — gera pares de jogadores por fase, com modo Por Grupo (round-robin) ou Geral (sorteio aleatório); confrontos salvos sem data/hora
type: feature
---

## Tabela `matchups`

- Colunas: `tournament_id`, `fase`, `grupo`, `player1_id`, `player2_id`, `rodada` (nullable), `created_at`.
- **Não tem data/hora** — agendamento é feito separadamente pela aba Agenda via botão "Agendar partida".
- RLS: usuários autenticados têm CRUD total (ambiente compartilhado).

## Aba Confrontos (`MatchupsTab`)

Posição: entre Participantes e Registrar Resultados.

### Geração

- Select de **Fase** (usa `FASES` de `constants.ts`).
- RadioGroup de modo:
  - **Por grupo**: round-robin (circle method) dentro de cada grupo. Só habilitado em "Fase de Grupos" e quando há grupos definidos. Gera `rodada` sequencial.
  - **Geral**: shuffle de todos os jogadores, formando pares. Se número ímpar, último vira BYE.
- Modo padrão muda automaticamente: "Por grupo" para Fase de Grupos, "Geral" para as demais.
- Confrontos ficam em `useState` (drafts) até clicar **Salvar Confrontos**.
- Se já existem confrontos salvos para a mesma fase, pergunta se deve **substituir** ou **cancelar**.

### Visualização

- Drafts: agrupados por grupo → rodada (quando aplicável).
- Salvos: agrupados por fase → grupo → rodada. Cada item tem botões **Agendar partida** e **Remover**.

### Integração com Agenda

- Botão "Agendar partida" chama `onScheduleMatchup(player1Id, player2Id, grupo)` que:
  1. Muda a aba ativa em `TournamentPage` para "schedule".
  2. Pré-preenche em `ScheduleTab`: Jogador 1, Jogador 2 e Grupo.
  3. Usuário só precisa informar data e horário.
- `ScheduleTab` aceita `prefillPlayerId`, `prefillPlayer2Id` e `prefillGrupo`. O input de Grupo exibe "Grupo X" quando numérico, ou o nome cru (ex: "Final") para fases eliminatórias.

## Convenção do campo `grupo` em `matchups`

- Em "Fase de Grupos": número do grupo do jogador (ex: "1", "2").
- Nas fases eliminatórias com modo Geral: o próprio nome da fase (ex: "Final", "Semifinal") — pois não há grupos.
