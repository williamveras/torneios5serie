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

  // Build head-to-head map: matches grouped by (fase|rodada|grupo)
  // For each match with exactly two players, record winner by pontos_jogo.
  const matches = new Map<string, MatchResult[]>();
  for (const r of results) {
    const key = `${r.fase || ""}|${r.rodada}|${r.grupo}`;
    const arr = matches.get(key) || [];
    arr.push(r);
    matches.set(key, arr);
  }
  // h2h.get(`${a}|${b}`) = winnerId between a and b (if known)
  const h2h = new Map<string, string>();
  for (const arr of matches.values()) {
    if (arr.length !== 2) continue;
    const [a, b] = arr;
    if (a.player_id === b.player_id) continue;
    let winner: string | null = null;
    if (a.pontos_jogo > b.pontos_jogo) winner = a.player_id;
    else if (b.pontos_jogo > a.pontos_jogo) winner = b.player_id;
    if (!winner) continue;
    h2h.set(`${a.player_id}|${b.player_id}`, winner);
    h2h.set(`${b.player_id}|${a.player_id}`, winner);
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
    // 1º critério: pontos de vitória (desc)
    if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
    // 2º critério: quem não tem penalidades fica na frente
    if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
    // 3º critério: pontos de mesa (desc)
    if (a.pontosMesa !== b.pontosMesa) return b.pontosMesa - a.pontosMesa;
    // 4º critério: confronto direto (head-to-head) — vencedor à frente
    const winner = h2h.get(`${a.playerId}|${b.playerId}`);
    if (winner === a.playerId) return -1;
    if (winner === b.playerId) return 1;
    return 0;
  });
  rows.forEach((r, i) => { r.position = i + 1; });
  return rows;
}
