#!/bin/sh
# Run only on the VPS hosting the database, after the safety migration.
set -eu
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
test -x node_modules/.bin/esbuild
node_modules/.bin/esbuild ops/tournament-lifecycle.ts --bundle --platform=node --format=cjs --outfile=/opt/torneios-supabase/tournament-lifecycle.next.cjs
chmod 600 /opt/torneios-supabase/tournament-lifecycle.next.cjs
mv /opt/torneios-supabase/tournament-lifecycle.next.cjs /opt/torneios-supabase/tournament-lifecycle.cjs
install -m 644 ops/torneios-lifecycle.service /etc/systemd/system/torneios-lifecycle.service
install -m 644 ops/torneios-lifecycle.timer /etc/systemd/system/torneios-lifecycle.timer
systemctl daemon-reload
systemctl enable --now torneios-lifecycle.timer
systemctl start torneios-lifecycle.service
