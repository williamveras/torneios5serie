#!/bin/sh
set -eu
umask 077
backup_dir=/root/torneios-backups
mkdir -p "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp="$backup_dir/.torneios-$stamp.backup.tmp"
out="$backup_dir/torneios-$stamp.backup"
trap 'rm -f "$tmp"' EXIT HUP INT TERM
docker exec supabase-db pg_dump -U postgres -d postgres -Fc > "$tmp"
docker exec -i supabase-db pg_restore -l > /dev/null < "$tmp"
mv "$tmp" "$out"
find "$backup_dir" -maxdepth 1 -type f -name 'torneios-*.backup' -mtime +14 -delete
printf '%s\n' "$out"
