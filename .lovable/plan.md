
## Objetivo

Permitir configurar em cada torneio uma **fase extra de Repescagem** (mata-mata em jogo único) entre a Fase de Grupos e a Segunda Fase. Os vencedores da repescagem se juntam aos classificados diretos para formar a chave da Segunda Fase.

Fluxo do torneio de duplas do exemplo:
- 150 duplas → 25 grupos de 6 → Fase de Grupos (round-robin, 5 jogos por dupla)
- Classificam direto: 1º de cada grupo (25) + 7 melhores 2ºs no ranking geral = **32**
- Repescagem: as **64** duplas seguintes disputam 32 confrontos de jogo único → **32 vencedores**
- Segunda Fase: 32 + 32 = **64 duplas** em mata-mata até a Final

## Configuração (Configurações do torneio)

Nova seção "Repescagem" com dois modos:

- **Ranking (atual)** — os N melhores próximos colocados são promovidos direto à Segunda Fase.
- **Fase extra (novo)** — os N seguintes disputam mata-mata de jogo único; os vencedores avançam.

Quando "Fase extra" estiver ativa, o campo passa a ser **"Quantas duplas disputam a repescagem"** (ex: 64). Preview atualiza para mostrar o total esperado da Segunda Fase (`diretos + repescagem/2`) e valida se fecha em potência de 2.

## Como funciona em cada aba

- **Classificação (StandingsTab / PublicStandings)**: quando modo = fase extra, mostra 3 blocos — Classificados diretos · Para a repescagem · Eliminados. Os textos "próximo colocado" viram "vai para a repescagem".
- **Confrontos (MatchupsTab)**: nova fase selecionável **"Repescagem"** aparece no filtro apenas para torneios com o modo ativado. Sorteio livre (aleatório) via `scheduled_draws` reutilizando a lógica atual de sorteio de mata-mata, com pool = duplas da repescagem calculadas pela função `computeQualifiers`.
- **Agenda / Resultados**: nada especial — a fase "Repescagem" flui pelas mesmas telas.
- **Segunda Fase**: quando o pool for gerado (aba Confrontos → gerar chaveamento da Segunda Fase), o sistema une classificados diretos + vencedores da repescagem antes de sortear.

## Implementação

### Banco de dados (1 migration)

Colunas em `public.tournaments`:
- `repescagem_mode text` — `'ranking'` (default, comportamento atual) ou `'playoff'`.
- `repescagem_playoff_size int` — quantas duplas entram na repescagem quando modo = playoff.

Sem novas tabelas. `matchups`, `match_results`, `phase_status`, `match_schedule` já têm coluna `fase` e aceitam qualquer string.

### Constantes / fases

`src/lib/constants.ts`: adicionar `"Repescagem"` ao array `FASES`, entre `"Fase de Grupos"` e `"Segunda Fase"`. Marcar como fase condicional na projeção (`buildMainFases` em `src/lib/phase.ts`): incluída só quando `repescagem_mode === 'playoff'`.

### Lógica de classificados

`src/lib/qualifiers.ts` — nova opção `mode: 'ranking' | 'playoff'` e `playoffSize`:
- Modo ranking: comportamento atual (retorna `repescagem` como classificados diretos extras).
- Modo playoff: separa `direct` (1ºs + top-N 2ºs onde `N = playoffSize/2 - numGroups` calculado do bracket final, ou explicitamente configurado por `direct_extra`), `playoff` (as `playoffSize` seguintes que jogam a repescagem) e `notQualified`.

Nota: no exemplo do usuário são 25 diretos + 7 melhores 2ºs + 64 na repescagem. Para não impor uma fórmula rígida, mantenho **3 configuráveis independentes**: `direct_per_group` (1), `repescagem_total` (7 — reaproveitado como "melhores extras que vão direto") e `repescagem_playoff_size` (64). O preview mostra o total resultante.

### UI

- `TournamentSettingsDialog.tsx`: `Select` "Modo de repescagem" e o input adicional. Preview atualizado com a fórmula `diretos_por_grupo × grupos + melhores_extras + playoff_size/2`.
- `StandingsTab.tsx` + `PublicStandings.tsx`: renderizar terceiro bloco "Repescagem" quando modo = playoff. Rótulo da aba passa a mostrar "Classificados (Repescagem)" quando a fase ativa é a repescagem.
- `MatchupsTab.tsx`: ao selecionar fase "Repescagem", o sorteio usa como pool os IDs de `computeQualifiers(...).playoff`. Reutiliza `scheduled_draws` com `mode='geral'`.
- `useMainFases` / `useStandingsTabLabel` / `getActivePublicPhase`: incluir "Repescagem" quando aplicável.

### Sorteio (RPC)

`execute_scheduled_draws` já sorteia mata-mata geral (`mode='geral'`) a partir de todos jogadores não eliminados. Para a Repescagem precisamos passar um pool explícito. Solução: reaproveitar a coluna já existente `player_pool uuid[]` do `scheduled_draws` (se não existir, adiciono na migration). Quando a fase = "Repescagem" e há `player_pool`, o RPC sorteia dentro do pool.

### Segunda Fase pós-repescagem

Ao gerar confrontos da Segunda Fase quando a repescagem está ativa e concluída, o pool passa a ser: `direct qualifiers` + `vencedores dos match_results da fase 'Repescagem'`. Isso vive em `MatchupsTab.tsx` (helper `poolForNextPhase`).

## Fora do escopo

- Repescagem em múltiplos rounds (fica jogo único conforme resposta do usuário).
- Seeding (sorteio livre conforme resposta).
- Migração retroativa de torneios antigos — o default é `ranking` (comportamento atual preservado).

## Entregáveis

1. Migration com 2 colunas em `tournaments` (+ `player_pool` em `scheduled_draws` se necessário) e ajuste no RPC `execute_scheduled_draws`.
2. `constants.ts` + `phase.ts` + `qualifiers.ts` atualizados.
3. `TournamentSettingsDialog.tsx` com nova seção.
4. `StandingsTab.tsx`, `PublicStandings.tsx`, `MatchupsTab.tsx` reconhecendo a fase.
5. Rótulos e projeção de próxima fase em `useMainFases`, `useStandingsTabLabel`, `getActivePublicPhase`.
