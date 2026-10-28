"""Run locally on the database VPS after backup and public mesa capture."""
import argparse
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser()
parser.add_argument("--database", required=True)
parser.add_argument("--mesas", required=True)
args = parser.parse_args()
if args.database not in ("postgres", "torneios_safety_test"):
    raise SystemExit("Unexpected database")
rows = json.loads(Path(args.mesas).read_text())
if not rows or len({r["id"] for r in rows}) != len(rows):
    raise SystemExit("Invalid mesa snapshot")
payload = json.dumps(rows).replace("'", "''")
migration = (Path(__file__).resolve().parents[1] / "supabase/migrations/20261028015846_tournament_safety_hardening.sql").read_text()
sql = f"""
SET LOCAL lock_timeout='10s';
LOCK TABLE public.matchups IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE legacy_mesa_numbers(id uuid PRIMARY KEY,n integer NOT NULL CHECK(n>0));
INSERT INTO legacy_mesa_numbers SELECT (v->>'id')::uuid,(v->>'mesa')::integer FROM jsonb_array_elements('{payload}'::jsonb) v;
DO $$ BEGIN
 IF EXISTS(SELECT id FROM public.matchups WHERE fase<>'Fase de Grupos' EXCEPT SELECT id FROM legacy_mesa_numbers)
 OR EXISTS(SELECT id FROM legacy_mesa_numbers EXCEPT SELECT id FROM public.matchups WHERE fase<>'Fase de Grupos')
 THEN RAISE EXCEPTION 'Matchups changed since capture; capture again before migrating.'; END IF;
END $$;
""" + migration + """
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.matchups m JOIN legacy_mesa_numbers n USING(id) WHERE m.mesa_numero IS DISTINCT FROM n.n)
 THEN RAISE EXCEPTION 'Mesa numbering did not match the capture'; END IF;
END $$;
"""
subprocess.run(["docker", "exec", "-i", "supabase-db", "psql", "-X", "-U", "postgres", "-d", args.database, "-v", "ON_ERROR_STOP=1", "-1"], input=sql, text=True, check=True)
print("Safety migration committed; captured mesa numbering preserved.")
