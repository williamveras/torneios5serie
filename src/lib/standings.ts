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
}

export function computeStandings(
  results: MatchResult[],
  getPlayerName: (id: string) => string,
  getPlayerNick: (id: string) => string,
): StandingRow[] {
  const agg = new Map<string, { pontosJogo: number; pontosMesa: number; penalties: string[] }>();
  for (const r of results) {
    const prev = agg.get(r.player_id) || { pontosJogo: 0, pontosMesa: 0, penalties: [] };
    prev.pontosJogo += r.pontos_jogo;
    prev.pontosMesa += r.pontos_mesa;
    if (r.penalidades !== "Sem penalidades") prev.penalties.push(r.penalidades);
    agg.set(r.player_id, prev);
  }

  const rows: StandingRow[] = [];
  for (const [playerId, data] of agg) {
    rows.push({
      position: 0,
      playerId,
      playerName: getPlayerName(playerId),
      nick: getPlayerNick(playerId),
      pontosJogo: data.pontosJogo,
      pontosMesa: data.pontosMesa,
      penalidades: data.penalties.length > 0 ? data.penalties.join("; ") : "Sem penalidades",
      hasPenalty: data.penalties.length > 0,
    });
  }

  rows.sort((a, b) => {
    if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
    if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
    return b.pontosMesa - a.pontosMesa;
  });
  rows.forEach((r, i) => { r.position = i + 1; });
  return rows;
}
