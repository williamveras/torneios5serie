---
name: Match Scheduling
description: Agenda format, hierarchical grouping by Group and Date, prefill from PlayersTab, observations field, and reallocation
type: feature
---

## Estrutura da Agenda

- Tabela: `match_schedule` (player1_id, player2_id, grupo, data_partida, horario, observacao).
- `data_partida` e `horario` são **opcionais** (nullable). `observacao` é texto livre opcional.
- Visualização hierárquica: agrupado primeiro por **Grupo**, depois por **Data**. Itens sem data ficam em "Sem data definida".
- Cada item exibe: "Jogador 1 e Jogador 2: HH:MM" — quando não há horário, mostra a observação (ex.: "a definir", "W.O") no lugar.

## Regras do formulário

- Jogadores são obrigatórios; grupo é auto-preenchido.
- Validação: ou (data + horário) preenchidos, ou observação preenchida. Data sem horário (ou vice-versa) é inválido.
- Se houver apenas observação, o registro é gravado sem data/horário e a observação aparece no lugar do horário.

## Integração com Participantes

- `PlayersTab` tem botão "Opções" por jogador (dropdown: Editar, Agendar partida, Remover).
- Ao clicar em "Agendar partida", `TournamentPage` muda a aba para Agenda e passa `prefillPlayerId` para `ScheduleTab`.

## Realocação

- Botão "Realocar" abre dialog com mesmos campos (incluindo observação).

## Formato de data

- Input aceita `DD/MM` (ano corrente assumido) ou `DD/MM/YYYY`.
- Armazenado em ISO `YYYY-MM-DD` no banco.

## Página pública (PublicSchedule)

- Mostra horário; se ausente, mostra observação ou "A definir".
- Datas passadas são ocultadas; sem data são mantidas no fim da listagem.
