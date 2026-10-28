# Tournament safety release

The primary VPS owns the PostgreSQL database and lifecycle service. The VIP VPS
only needs the frontend deployment, using its existing site configuration.

Apply `20261028015846_tournament_safety_hardening.sql` in a single transaction
after a verified backup. Before applying to an existing installation, capture
the mesa numbers in its public UI/API and load a temporary table
`legacy_mesa_numbers(id uuid primary key, n integer)` in the same transaction.
The migration uses those numbers instead of deriving a new order. Matchups must
remain locked while checking the capture and applying the migration.

Build/install the worker with `sh ops/install-tournament-lifecycle.sh` on the
database VPS. It reuses the frontend's qualification functions, applies a
revision-checked projection every five seconds, and never changes saved pairs.
The database still synchronizes result elimination in the result transaction.
The worker closes/reopens phases, updates the champion, and synchronizes group
qualification. Draw requests refuse dirty or conflicting projections.

Existing accepted group pools are preserved while their source results,
participants, withdrawal reasons and qualification configuration are unchanged.
This avoids reinterpreting legacy tournaments with incomplete historical schedules.
Corrections invalidate that baseline and trigger calculation and conflict checks.

Both frontend deployments use `ops/deploy-frontend.sh` as before. Future changes
to shared qualification logic also require reinstalling the lifecycle bundle on
the primary VPS. Do not install a second worker/database on VIP.

Validation: Vitest lifecycle/public schedule/qualification tests, TypeScript,
production build, `ops/test-tournament-safety.sql`, and
`ops/test-auto-result-elimination.sql`. SQL tests create temporary fixtures and
roll back. Run them on an isolated restored database, with mail workers disabled.

Operational checks: `systemctl status torneios-lifecycle.timer`,
`journalctl -u torneios-lifecycle.service`, private `tournament_security.lifecycle`
dirty/conflicts counts, and the tournament administrator's conflict notice.
Failed scheduled draws now show the reason in the administrative draw list.
