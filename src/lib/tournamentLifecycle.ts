import type { Tables } from "@/integrations/supabase/types";
import { computeQualifiers, isOutOfTournament } from "./qualifiers";
import { applyPlayerEliminations } from "./playerElimination";
import { computeCurrentRound } from "./rounds";
import { projectPhases } from "./phaseProjection";

export interface TournamentSnapshot {
  tournament: Tables<"tournaments">;
  players: Tables<"players">[];
  results: Tables<"match_results">[];
  matchups: Tables<"matchups">[];
  statuses: Tables<"phase_status">[];
  legacyGroupPool?: string[] | null;
  legacyPlayoffPool?: string[] | null;
}

/** Shared, deterministic projection. The server applies it against a locked revision. */
export function deriveTournament(snapshot: TournamentSnapshot) {
  const { tournament: t, players, results, matchups, statuses } = snapshot;
  const excluded = new Set(players.filter(p => p.elimination_reason || results.some(r => r.player_id === p.id && isOutOfTournament(r.penalidades))).map(p => p.id));
  const groupResults = applyPlayerEliminations(results.filter(r => r.fase === "Fase de Grupos"), players);
  const groups = matchups.filter(m => m.fase === "Fase de Grupos");
  const groupComplete = snapshot.legacyGroupPool != null || (t.numero_rodadas
    ? groups.length > 0 && computeCurrentRound(groups, results, t.numero_rodadas).phaseComplete
    : statuses.some(s => s.fase === "Fase de Grupos" && s.status === "concluida"));
  const q = computeQualifiers(groupResults, id => id, () => "", {
    directPerGroup: t.direct_per_group ?? undefined,
    repescagemTotal: t.repescagem_enabled === false ? 0 : t.repescagem_total ?? undefined,
    lowerWins: t.lower_score_wins, h2hFirst: t.h2h_before_mesa,
    mode: t.repescagem_mode as "ranking" | "playoff", playoffSize: t.repescagem_playoff_size ?? undefined,
    byePosition: t.bye_rank_position ?? undefined, byeTotal: t.bye_rank_total ?? undefined,
  });
  const qualified = new Set(snapshot.legacyGroupPool ?? [...q.direct, ...q.repescagem, ...q.playoff].map(p => p.playerId));
  const playoff = new Set(snapshot.legacyPlayoffPool ?? q.playoff.map(p => p.playerId));
  const automatic = [...qualified].filter(id => !playoff.has(id));
  const groupEliminated = groupComplete ? players.filter(p => groupResults.some(r => r.player_id === p.id) && !qualified.has(p.id)).map(p => p.id) : [];
  const phases: Record<string, boolean> = {};
  if (groups.length && t.numero_rodadas) phases["Fase de Grupos"] = groupComplete;
  const winners: Record<string, string[]> = {};
  const losers: Record<string, string[]> = {};
  for (const phase of new Set(matchups.filter(m => m.fase !== "Fase de Grupos").map(m => m.fase))) {
    winners[phase] = []; losers[phase] = [];
    const matches = matchups.filter(m => m.fase === phase);
    for (const m of matches) {
      const a = results.find(r => r.fase === phase && r.player_id === m.player1_id);
      const b = results.find(r => r.fase === phase && r.player_id === m.player2_id);
      if (!a || !b) continue;
      let win: string | null = null;
      if (a.pontos_jogo !== b.pontos_jogo) win = a.pontos_jogo > b.pontos_jogo ? a.player_id : b.player_id;
      else if (a.pontos_mesa !== b.pontos_mesa) win = (a.pontos_mesa < b.pontos_mesa) === t.lower_score_wins ? a.player_id : b.player_id;
      if (win) { winners[phase].push(win); losers[phase].push(win === a.player_id ? b.player_id : a.player_id); }
    }
    phases[phase] = matches.length > 0 && winners[phase].length === matches.length;
  }
  // Phases with all matches removed must reopen too.
  for (const s of statuses) if (s.fase !== "Fase de Grupos" && !(s.fase in phases)) phases[s.fase] = false;
  const eligible: Record<string, string[]> = {};
  const expected: Record<string, number> = {};
  const conflicts: string[] = [];
  const initial = t.elimination_only ? players.map(p => p.id) : automatic;
  const groupCount = new Set(players.map(p => p.grupo).filter(Boolean)).size;
  const rep = t.repescagem_enabled === false ? 0 : t.repescagem_total ?? 18;
  const configuredPool = groupCount * (t.direct_per_group ?? 5) + rep;
  const configuredMain = t.repescagem_mode === "playoff"
    ? t.bye_rank_total && t.bye_rank_position
      ? Math.min(configuredPool, groupCount + (t.bye_rank_position === 1 ? 0 : t.bye_rank_total)) + Math.ceil((configuredPool - Math.min(configuredPool, groupCount + (t.bye_rank_position === 1 ? 0 : t.bye_rank_total))) / 2)
      : configuredPool + Math.ceil((t.repescagem_playoff_size ?? 0) / 2)
    : configuredPool;
  const size = t.elimination_only ? players.length : snapshot.legacyGroupPool ? automatic.length + Math.ceil(playoff.size / 2) : configuredMain;
  const projection = projectPhases(size);
  if (groupComplete && playoff.size) {
    eligible.Repescagem = [...playoff]; expected.Repescagem = playoff.size;
    if (matchups.filter(m => m.fase === "Repescagem").length * 2 !== playoff.size) phases.Repescagem = false;
  }
  for (let i = 0; i < projection.length; i++) {
    const phase = projection[i].fase;
    expected[phase] = projection[i].from;
    if (matchups.filter(m => m.fase === phase).length * 2 !== projection[i].from) phases[phase] = false;
    if (i === 0) {
      if (t.elimination_only || (groupComplete && (!playoff.size || phases.Repescagem)))
        eligible[phase] = [...initial, ...(t.elimination_only ? [] : winners.Repescagem || [])];
    } else if (phases[projection[i - 1].fase]) eligible[phase] = winners[projection[i - 1].fase] || [];
  }
  expected["Disputa de 3º Lugar"] = 2;
  if (matchups.filter(m => m.fase === "Disputa de 3º Lugar").length !== 1) phases["Disputa de 3º Lugar"] = false;
  if (phases.Semifinal) eligible["Disputa de 3º Lugar"] = losers.Semifinal || [];
  for (const phase of Object.keys(eligible)) eligible[phase] = eligible[phase].filter(id => !excluded.has(id));
  // Never rewrite a later draw when an earlier result is corrected.
  for (const phase of new Set(matchups.filter(m => m.fase !== "Fase de Grupos").map(m => m.fase))) {
    const actual = new Set(matchups.filter(m => m.fase === phase).flatMap(m => [m.player1_id, m.player2_id]));
    // Explicit withdrawals after a valid draw do not invalidate its historical participants.
    const allowed = new Set([...(eligible[phase] || []), ...excluded]);
    if (!eligible[phase] || actual.size !== expected[phase] || [...actual].some(id => !allowed.has(id)))
      conflicts.push(`${phase}: os confrontos existentes não correspondem à classificação atual. Revise os resultados e os confrontos antes de continuar.`);
  }
  return { phases, eligible, expected, groupEliminated, conflicts,
    champion: phases.Final && !conflicts.length ? winners.Final?.[0] ?? null : null };
}
