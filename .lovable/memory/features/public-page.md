---
name: Public Tournament Page
description: Public read-only page at /p/:tournamentId with phase_status banner control
type: feature
---
- Route `/p/:tournamentId` (no auth) shows Agenda, Resultados, Classificação.
- Reads via public RLS policies on `tournaments`, `match_results`, `match_schedule`, `phase_status`. Players read via `players_public` view (security_invoker=on) — exposes only id, nome_completo, nick_playroom, grupo. WhatsApp/comentário/preferencias never reach the public client.
- `phase_status` table: (tournament_id, fase, status). status defaults to `em_andamento`. Public SELECT, authenticated write.
- Banner UX: yellow "Fase em andamento — parcial" when status=em_andamento; green "Fase encerrada — oficial" when concluida. Shown in PublicResults and PublicStandings only when there are results.
- Admin toggle lives in `StandingsTab` next to fase selector (Lock/Unlock icons).
- Share button on `TournamentPage` header copies `${origin}/p/${id}` to clipboard.
- Standings calc shared via `src/lib/standings.ts` (`computeStandings`).
