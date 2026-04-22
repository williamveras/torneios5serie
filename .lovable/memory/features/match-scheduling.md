---
name: Match Scheduling
description: Agenda format, hierarchical grouping by Group and Date, prefill from PlayersTab, and reallocation
type: feature
---

## Estrutura da Agenda

- Tabela: `match_schedule` (player1_id, player2_id, grupo, data_partida, horario).
- Visualização hierárquica: agrupado primeiro por **Grupo**, depois por **Data**.
- Cada item exibe: "Jogador 1 e Jogador 2: HH:MM" + botões Realocar e Remover.

## Integração com Participantes

- `PlayersTab` tem botão "Opções" por jogador (dropdown: Editar, Agendar partida, Remover).
- Ao clicar em "Agendar partida", `TournamentPage` muda a aba para Agenda e passa `prefillPlayerId` para `ScheduleTab`.
- `ScheduleTab` pré-preenche Jogador 1 e Grupo (do jogador) automaticamente; usuário só informa Jogador 2, data e horário.

## Realocação

- Botão "Realocar" abre o mesmo dialog de edição do agendamento, focado em alterar data e horário (jogadores e grupo também editáveis se necessário).
- Título do dialog: "Realocar Partida".

## Formato de data

- Input aceita `DD/MM` (ano corrente assumido) ou `DD/MM/YYYY`.
- Armazenado em ISO `YYYY-MM-DD` no banco.
