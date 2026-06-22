# Suporte a torneios em duplas

Objetivo: permitir criar torneios onde cada "competidor" é uma dupla (2 jogadores), mantendo todas as regras atuais (fases, sorteio, classificação, penalidades, mesa, página pública), sem quebrar os torneios individuais existentes.

## Abordagem

Adicionar uma **modalidade** ao torneio (`individual` | `duplas`) e introduzir o conceito de **dupla** como uma entidade que se comporta exatamente como um "player" hoje. Para minimizar refatoração, a dupla será representada na própria tabela `players` (registro "virtual" representando a dupla), com uma nova tabela auxiliar `team_members` ligando os 2 jogadores reais à dupla.

Vantagem: `matchups`, `match_schedule`, `match_results`, sorteio, standings, mesa, classificados, página pública continuam funcionando sem alterações estruturais — eles operam sobre o "player" que, em torneios de dupla, representa a dupla.

## Mudanças no banco

1. `tournaments`: adicionar coluna `modalidade text not null default 'individual'` (`'individual' | 'duplas'`).
2. `players`: adicionar `is_team boolean not null default false`. Em torneios de dupla, o registro da dupla terá `is_team = true` e `nome_completo` = nome da dupla; `nick_playroom` = nicks concatenados (ex: "nick1 / nick2").
3. Nova tabela `team_members`:
   - `id uuid pk`, `team_id uuid -> players(id) on delete cascade`, `member_nome text not null`, `member_nick text`, `member_email text`, `member_whatsapp text`, `position smallint` (1 ou 2).
   - GRANTs para `authenticated` e `service_role`; RLS aberta como nas outras tabelas do projeto.
4. Sem mudanças em `matchups`/`match_results`/`match_schedule` — continuam apontando para `players.id` (que é a dupla quando `is_team=true`).

## Mudanças no app

### Criação/configuração do torneio
- `TournamentSettingsDialog` (ou criação): seletor "Modalidade" (Individual / Duplas). Bloquear troca após existirem players.

### Cadastro de duplas
- `PlayersTab`: quando `modalidade='duplas'`, formulário com 2 blocos (Jogador 1 / Jogador 2: nome, nick, email, whatsapp) + "Nome da dupla" opcional (default: "nick1 & nick2"). Salva 1 row em `players` (is_team=true) + 2 rows em `team_members`.
- Link público de inscrição (`PublicRegistration` + `register_player_via_token`): adicionar campos do parceiro quando o torneio for de duplas; função RPC adaptada para criar a dupla + membros.

### Exibição
- Helpers `getPlayerName`/`getPlayerNick` passam a, para `is_team=true`, retornar o nome da dupla e os nicks combinados.
- Página pública (Standings, Schedule, Results, Draw, Qualifiers), `MatchupsTab`, `ResultsTab`, `ScheduleTab`, `BracketView`: nenhuma mudança lógica; apenas o label já fica correto via helper. Ajustar somente onde houver UI específica para "Jogador".
- "eder.bononi, mesa X" vira "nick1 & nick2, mesa X" em duplas.

### Sorteio e fases
- `execute_scheduled_draws` continua funcionando: sorteia entre `players` ativos do torneio. Como cada dupla é 1 row, o pareamento já fica dupla x dupla.
- Lógica de promoção entre fases / qualificação (`qualificationSuggest`, `phaseProjection`, `StandingsTab`) opera sobre `player_id` — sem alteração.

### Importação / resultados
- `ImportMatchupsDialog`, `ImportResultsDialog`, `matchupParser`, `resultsParser`: aceitar como identificador o nome/nick da dupla. Resolver para `players.id` (is_team=true) por correspondência igual ao individual.

### Inscrição via Google Forms (CSV/XLSX)
- Mapper de importação (memória `player-import`): em modalidade duplas, mapear 2 conjuntos de colunas (Jogador 1 / Jogador 2) e criar dupla + membros.

## Compatibilidade
- Torneios existentes: `modalidade='individual'` por default; comportamento idêntico ao atual.
- Helpers checam `is_team` antes de mudar formato — sem impacto em individual.

## Itens fora deste escopo (pode virar follow-up)
- Estatísticas por jogador dentro da dupla.
- Trocar parceiro no meio do torneio.
- Rankings cruzados (jogador aparece em várias duplas).

## Ordem de implementação
1. Migração: `tournaments.modalidade`, `players.is_team`, tabela `team_members` (+ GRANTs + RLS).
2. Seletor de modalidade na criação/configuração do torneio.
3. Cadastro manual de duplas em `PlayersTab` + helpers de nome/nick.
4. Link público de inscrição e importação CSV adaptados.
5. Ajustes finos de UI nas abas e página pública (rótulos "Jogador" → "Dupla").
6. Teste end-to-end com um torneio de duplas pequeno antes do torneio real.
