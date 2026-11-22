import { validCriteria, defaultCriteria } from "./tiebreakers";
import { matchStats, sortCustomStandings } from "./customStandings";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;

export interface StandingRow {
  position: number;
  playerId: string;
  playerName: string;
  nick: string;
  pontosJogo: number;
  pontosMesa: number;
  penalidades: string;
  hasPenalty: boolean;
  wins?: number;
  penaltyCount?: number;
}

export function computeStandings(
  results: MatchResult[],
  getPlayerName: (id: string) => string,
  getPlayerNick: (id: string) => string,
  opts: { lowerWins?: boolean; h2hFirst?: boolean; criteria?: string[] | null } = {},
): StandingRow[] {
  const lowerWins = !!opts.lowerWins;
  const h2hFirst = !!opts.h2hFirst;
  const agg = new Map<string, { pontosJogo: number; pontosMesa: number; penalties: string[] }>();
  for (const r of results) {
    const prev = agg.get(r.player_id) || { pontosJogo: 0, pontosMesa: 0, penalties: [] };
    prev.pontosJogo += r.pontos_jogo;
    prev.pontosMesa += r.pontos_mesa;
    if (r.penalidades !== "Sem penalidades") prev.penalties.push(r.penalidades);
    agg.set(r.player_id, prev);
  }

  const stats = matchStats(results);
  const rows: StandingRow[] = [];
  for (const [playerId, data] of agg) {
    rows.push({
      position: 0,
      playerId,
      playerName: getPlayerName(playerId),
      nick: getPlayerNick(playerId),
      pontosJogo: data.pontosJogo,
      pontosMesa: data.pontosMesa,
      penalidades: data.penalties.includes("Eliminado por W.O")
        ? "Eliminado por W.O"
        : data.penalties.includes("Desistente")
        ? "Desistente"
        : data.penalties.length > 0
          ? Array.from(new Set(data.penalties)).join("; ")
          : "Sem penalidades",
      hasPenalty: data.penalties.length > 0,
      wins: stats.wins.get(playerId) || 0, penaltyCount: data.penalties.filter(p => p && p.split(";").some(v => v.trim() && !/^(sem penalidades|desistente|eliminado por w\.o)$/i.test(v.trim()))).length,
    });
  }

  return sortCustomStandings(rows, validCriteria(opts.criteria) ? opts.criteria : defaultCriteria(h2hFirst), lowerWins, stats.direct);
}
