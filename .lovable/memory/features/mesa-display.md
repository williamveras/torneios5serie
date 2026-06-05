---
name: Mesa display in elimination phases
description: For non-group phases (mata-mata), UI shows "Mesa N" instead of "Grupo X / Rodada Y" both publicly and in admin tabs.
type: feature
---

## Concept

- In "Fase de Grupos": rendering uses Grupo + Rodada (existing behavior).
- In any other fase (mata-mata): `grupo` field in DB stores the fase name; UI labels each matchup as "Mesa N" where N = ordinal position of the matchup within the fase, ordered by `matchups.created_at` ascending.
- No DB change. The mesa number is computed at display time.

## Helpers — `src/lib/phase.ts`

- `getActivePublicPhase(phaseStatuses)` — public-facing "current" phase = next phase after last `concluida`; defaults to "Fase de Grupos".
- `isGroupPhase(fase)` — `fase === "Fase de Grupos"`.
- `pairKey(a, b)` — sorted-pair key for matching player pairs irrespective of order.
- `buildMesaMap(matchups, fase)` — returns `Map<pairKey, mesaNumber>`.

## Where applied

Public (uses helpers):
- `PublicSchedule.tsx` — when active fase is non-group, renders flat "Mesa N: A x B" list. Description: `Confrontos da {fase}.` Shows "Ainda não há confrontos cadastrados…" when empty.
- `PublicResults.tsx` — adds fase selector (defaults to active phase). For non-group, groups results by Mesa (accordion shows "Mesa N (k confrontos)"); hides Rodada filter; localizacao text uses "mesa N".

Admin (inline lookup, not the helper):
- `MatchupsTab.tsx` — saved matchups in non-group fase render as flat "Mesa N: A vs B" list (no group sub-header). Drafts preview also numbers them "Mesa N".
- `ScheduleTab.tsx` — fetches `matchups.created_at` so it can compute mesa. The form's "Grupo" field becomes "Mesa N (fase)" for non-group. In the list, rows in non-group fases get a "Mesa N:" prefix and the redundant group sub-header is hidden.
- `ResultsTab.tsx` — "Rodada" input is relabeled "Mesa" for non-group fases (DB column `rodada` stores the value either way).
