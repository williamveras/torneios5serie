import type { Tables } from "@/integrations/supabase/types";
import type { StandingRow } from "./standings";
import type { Criterion } from "./tiebreakers";
type Result = Tables<"match_results">;

/** The same grouping used by the public result log; each submission is one game. */
export function matchStats(results: Result[]) {
  const matches = new Map<string, Result[]>();
  const wins = new Map<string, number>();
  const direct = new Map<string, number>();
  for (const r of results) {
    // Victory points are awarded only to winners; table points never add wins.
    if (r.pontos_jogo > 0) wins.set(r.player_id, (wins.get(r.player_id) || 0) + 1);
    const key = `${r.created_at}|${r.fase || ""}|${r.grupo}|${r.rodada}`;
    matches.set(key, [...(matches.get(key) || []), r]);
  }
  for (const match of matches.values()) {
    if (match.length < 2 || new Set(match.map(r => r.player_id)).size !== match.length) continue;
    const score = Math.max(...match.map(r => r.pontos_jogo));
    const leaders = match.filter(r => r.pontos_jogo === score);
    if (leaders.length !== 1 || score <= 0) continue;
    const winner = leaders[0].player_id;
    if (match.length === 2) {
      const loser = match.find(r => r.player_id !== winner)!.player_id;
      direct.set(`${winner}|${loser}`, (direct.get(`${winner}|${loser}`) || 0) + 1);
    }
  }
  return { wins, direct };
}

export function compareCriterion(a: StandingRow, b: StandingRow, criterion: Criterion, lowerWins: boolean): number {
  switch (criterion) {
    case "victory_points": return b.pontosJogo - a.pontosJogo;
    case "wins": return (b.wins || 0) - (a.wins || 0);
    case "penalties": return (a.penaltyCount || 0) - (b.penaltyCount || 0);
    case "penalty_presence": return Number(a.hasPenalty) - Number(b.hasPenalty);
    case "table_points": return lowerWins ? a.pontosMesa - b.pontosMesa : b.pontosMesa - a.pontosMesa;
    default: return 0;
  }
}

/** Resolve tied blocks, avoiding non-transitive pairwise head-to-head sorting. */
export function sortCustomStandings(rows: StandingRow[], criteria: Criterion[], lowerWins: boolean, direct = new Map<string, number>()): StandingRow[] {
  const rank = (tied: StandingRow[], index: number): StandingRow[] => {
    if (tied.length < 2 || index >= criteria.length) return tied;
    const criterion = criteria[index];
    if (criterion === "head_to_head") {
      // A direct match is meaningful for exactly two tied players; otherwise
      // continue to the next criterion instead of inventing a mini-league rule.
      if (tied.length !== 2) return rank(tied, index + 1);
      const [a, b] = tied;
      const diff = (direct.get(`${b.playerId}|${a.playerId}`) || 0) - (direct.get(`${a.playerId}|${b.playerId}`) || 0);
      return diff ? (diff < 0 ? [a, b] : [b, a]) : rank(tied, index + 1);
    }
    const sorted = [...tied].sort((a, b) => compareCriterion(a, b, criterion, lowerWins));
    const blocks: StandingRow[][] = [];
    for (const row of sorted) {
      const last = blocks[blocks.length - 1];
      if (last && compareCriterion(last[0], row, criterion, lowerWins) === 0) last.push(row);
      else blocks.push([row]);
    }
    return blocks.flatMap(block => rank(block, index + 1));
  };
  const out = (row: StandingRow) => /desistente|eliminado por w\.o/i.test(row.penalidades);
  return [...rank(rows.filter(r => !out(r)), 0), ...rank(rows.filter(out), 0)].map((row, i) => ({ ...row, position: i + 1 }));
}
