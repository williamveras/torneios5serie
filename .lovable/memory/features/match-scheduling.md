---
name: Match Scheduling
description: Agenda format, hierarchical grouping by Rodada/Group/Date, prefill from PlayersTab, observations field, rodada field, and reallocation
type: feature
---

## Estrutura da Agenda

- Tabela: `match_schedule` (player1_id, player2_id, grupo, data_partida, horario, observacao, rodada).
- `data_partida`, `horario`, `observacao` e `rodada` são **opcionais** (nullable).
- Visualização logada hierárquica: agrupado por **Rodada** (mais recente primeiro) → **Grupo** → **Data**. Itens sem rodada vão em "Sem rodada definida"; sem data em "Sem data definida".
- Cada item exibe: "Jogador 1 e Jogador 2: HH:MM" — quando não há horário, mostra a observação no lugar.
- Abaixo do formulário há um título separador "Partidas agendadas".

## Regras do formulário

- Jogadores são obrigatórios; grupo é auto-preenchido.
- Validação: ou (data + horário) preenchidos, ou observação preenchida.
- Rodada é opcional (inteiro >= 1).

## Integração com Participantes / Confrontos

- `PlayersTab` → "Agendar partida" pré-preenche jogador.
- `MatchupsTab` → "Agendar partida" pré-preenche jogadores e grupo.

## Realocação

- Botão "Realocar" abre dialog com mesmos campos (incluindo observação e rodada).

## Formato de data

- Input aceita `DD/MM` (ano corrente) ou `DD/MM/YYYY`.

## Página pública (PublicSchedule)

- Mostra horário; se ausente, mostra observação ou "A definir".
- Datas passadas são ocultadas; sem data são mantidas no fim.
