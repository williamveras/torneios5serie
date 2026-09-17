#!/bin/sh
# Build a frontend release while preserving the installation's own site identity.
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /etc/torneios/site-config.json" >&2
  exit 2
fi

site_config=$1
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$root"
test -s .env.production || { echo "Missing .env.production" >&2; exit 1; }
test -s "$site_config" || { echo "Missing site configuration" >&2; exit 1; }
test ! -e dist-next || { echo "dist-next already exists" >&2; exit 1; }

npm ci
npm run build -- --outDir dist-next
install -m 644 "$site_config" dist-next/site-config.json
test -s dist-next/index.html

previous="dist-before-$(date -u +%Y%m%dT%H%M%SZ)"
if [ -d dist ]; then
  mv dist "$previous"
fi
mv dist-next dist
echo "Frontend deployed; previous version: $root/$previous"
