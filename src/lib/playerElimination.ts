import type { Tables } from "@/integrations/supabase/types";

export function applyPlayerEliminations(results: Tables<"match_results">[], players: { id: string; eliminado?: boolean; elimination_reason?: string | null }[]) {
  const penalties = new Map(players.filter(p => p.eliminado && p.elimination_reason)
    .map(p => [p.id, p.elimination_reason === "withdrawal" ? "Desistente" : "Eliminado por W.O"]));
  return results.map(r => penalties.has(r.player_id)
    ? { ...r, penalidades: [r.penalidades, penalties.get(r.player_id)].filter(Boolean).join("; ") }
    : r);
}
