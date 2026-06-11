# Project Memory

## Core
Language is Portuguese (pt-BR). Avoid auto-translation.
Professional minimal UI, neutral colors, sidebar layout.
Display "Nick no Playroom" first, fallback to Full Name.
Auth users have full read/write access to all data (shared team environment).
Track users via profiles to display who registers match results.

## Memories
- [Standings Logic](mem://features/standings-logic) — Ranking calculation logic, tie-breakers, and export features
- [Player Import](mem://features/player-import) — Google Forms CSV/XLSX import mapping for players
- [Match Registration](mem://features/match-registration) — Logic for registering match results, players per table, and penalties
- [Auth Requirements](mem://auth/requirements) — Required auth fields and profile linking for tracking actions
- [Player Display](mem://features/player-display) — Rules for displaying player names vs nicks across the app
- [Tournament Structure](mem://features/tournament-structure) — Tournament phases and grouping logic
- [Data Visibility](mem://auth/data-visibility) — Shared environment access rules for authenticated users
- [Match Scheduling](mem://features/match-scheduling) — Agenda format, hierarchical grouping by Group and Date
- [Matchups Generator](mem://features/matchups-generator) — Aba Confrontos: gera pares por fase (round-robin ou geral), sem data/hora
- [Group Management](mem://features/group-management) — Automatic/manual grouping, balance rules, and direct elimination transition
- [Qualification Rules](mem://features/qualification-rules) — Per-tournament config for direct/repescagem qualification with auto-suggestions
- [Mesa Display](mem://features/mesa-display) — Mata-mata phases show "Mesa N" instead of Grupo/Rodada (public + admin)
- [Scheduled Draws](mem://features/scheduled-draws) — Agendamento automático de sorteios via pg_cron + aviso público
- [Public Page](mem://features/public-page) — Public read-only route /p/:id with phase_status banner and players_public view
