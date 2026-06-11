---
name: Qualification Rules
description: Per-tournament configuration for group-phase qualification (direct + repescagem)
type: feature
---

## Configurable per torneio

Colunas em `public.tournaments`:
- `direct_per_group` (int, nullable) — quantos passam direto por grupo. Vazio = usa padrão 5.
- `repescagem_enabled` (bool, default true) — se a repescagem do próximo colocado está ativa.
- `repescagem_total` (int, nullable) — quantos melhores entram na repescagem. Vazio = usa padrão 18.

Editáveis via `TournamentSettingsDialog` (ícone de engrenagem no header do torneio). O diálogo gera sugestões automáticas a partir do número de inscritos e número de grupos (`src/lib/qualificationSuggest.ts`), procurando combinações que fechem num bracket potência de 2.

## Onde é aplicado

`computeQualifiers` (`src/lib/qualifiers.ts`) recebe `{ directPerGroup, repescagemTotal }`. Tanto `StandingsTab` (admin) quanto `PublicStandings` (público) leem essas colunas do torneio e passam essas opções. Quando vazias, o sistema usa o padrão histórico (5 + 18).
