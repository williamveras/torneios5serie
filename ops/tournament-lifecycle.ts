import { execFileSync } from "node:child_process";
import { deriveTournament } from "../src/lib/tournamentLifecycle";

// Uses the existing local PostgreSQL socket through Docker; no API secret or
// database password is embedded in the bundle or exposed to the frontend.
const db = process.env.TOURNAMENT_DB || "postgres";
const query = (sql: string) => execFileSync("docker", ["exec", "-i", "supabase-db", "psql", "-X", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-At"], { input: sql, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 30000 }).trim();
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const rows = JSON.parse(query("select coalesce(jsonb_agg(tournament_id),'[]') from tournament_security.lifecycle where dirty"));
let failed = false;
for (const tid of rows) {
  try {
    const snapshot = JSON.parse(query(`select tournament_security.snapshot(${literal(tid)}::uuid)`));
    const projection = deriveTournament(snapshot);
    if (process.argv.includes("--preview")) {
      console.log(JSON.stringify({ tournament: tid, champion: projection.champion, groupEliminated: projection.groupEliminated.length, conflicts: projection.conflicts, eligible: Object.fromEntries(Object.entries(projection.eligible).map(([k,v]) => [k,v.length])) }));
    } else {
      query(`select tournament_security.apply_projection(${literal(tid)}::uuid,${snapshot.revision},${literal(JSON.stringify(projection))}::jsonb)`);
    }
  } catch { failed = true; console.error(`Falha ao atualizar torneio ${tid}; será tentado novamente.`); }
}
if (failed) process.exitCode = 1;
