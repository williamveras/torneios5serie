import { describe, expect, it } from "vitest";
import { computeStandings } from "./standings";
import { computeQualifiers } from "./qualifiers";
import { deriveTournament, type TournamentSnapshot } from "./tournamentLifecycle";
import type { Tables } from "@/integrations/supabase/types";
const row = (player_id: string, pontos_jogo: number, pontos_mesa: number, penalidades = "Sem penalidades", rodada = 1, grupo = "1") => ({ id: `${player_id}-${rodada}`, player_id, pontos_jogo, pontos_mesa, penalidades, rodada, grupo, fase: "Fase de Grupos", created_at: `2026-11-${10 + rodada}T12:00:00Z` } as Tables<"match_results">);
const rank = (rows: ReturnType<typeof row>[], criteria?: string[] | null, lowerWins = false) => computeStandings(rows, id => id, id => id, { criteria, lowerWins });
describe("configurable ranking", () => {
  it("counts each positive victory result once, never counting table points", () => {
    const rows = [row("a", 3, 100), row("a", 3, 100, undefined, 2), row("b", 3, 50), row("b", 3, 50, undefined, 2), row("b", 3, 50, undefined, 3), row("c", 0, 999)];
    const ranked = rank(rows, ["victory_points", "wins", "table_points"]);
    expect(ranked.map(r => r.playerId)).toEqual(["b", "a", "c"]);
    expect(ranked.map(r => r.wins)).toEqual([3, 2, 0]);
  });
  it("counts repeated penalty occurrences and obeys their priority", () => {
    const rows = [row("a", 3, 100, "Outra"), row("a", 3, 100, "Outra", 2), row("b", 3, 20, "Outra"), row("b", 3, 20, undefined, 2)];
    expect(rank(rows, ["victory_points", "penalties", "table_points"]).map(r => r.playerId)).toEqual(["b", "a"]);
    expect(rank(rows, ["victory_points", "table_points", "penalties"]).map(r => r.playerId)).toEqual(["a", "b"]);
    expect(rank(rows, ["victory_points", "penalties"]).map(r => r.penaltyCount)).toEqual([1, 2]);
  });
  it("respects lower-table-score rules and never promotes withdrawals", () => {
    const rows = [row("a", 3, 100), row("b", 3, 20), row("out", 99, 0, "Sem penalidades; Desistente")];
    expect(rank(rows, ["victory_points", "table_points"], true).map(r => r.playerId)).toEqual(["b", "a", "out"]);
  });
  it("keeps legacy ranking when the new setting is absent", () => {
    const rows = [row("a", 3, 100, "Outra"), row("a", 3, 100, "Outra", 2), row("b", 3, 100, "Outra"), row("b", 3, 100, undefined, 2)];
    expect(rank(rows, null)).toEqual(rank(rows));
    expect(rank(rows).map(r => r.playerId)).toEqual(["a", "b"]);
    expect(rank(rows)[0].wins).toBeUndefined();
  });
  it("resolves a direct match only within a two-player tie", () => {
    const rows = [row("a", 3, 20), row("b", 0, 100), row("a", 0, 10, undefined, 2), row("b", 3, 100, undefined, 3)];
    expect(rank(rows, ["victory_points", "head_to_head", "table_points"]).map(r => r.playerId)).toEqual(["a", "b"]);
    const cycle = [row("a", 3, 10), row("b", 0, 20), row("b", 3, 20, undefined, 2), row("c", 0, 30, undefined, 2), row("c", 3, 30, undefined, 3), row("a", 0, 10, undefined, 3)];
    expect(rank(cycle, ["victory_points", "head_to_head", "table_points"]).map(r => r.playerId)).toEqual(["c", "b", "a"]);
  });
  it("uses the chosen criteria when filling cross-group qualification slots", () => {
    const rows = [row("top1", 9, 999), row("a", 3, 100, "Outra"), row("a", 3, 100, "Outra", 2), row("top2", 9, 999, undefined, 1, "2"), row("b", 3, 20, "Outra", 1, "2"), row("b", 3, 20, undefined, 2, "2")];
    const q = computeQualifiers(rows, id => id, id => id, { directPerGroup: 1, repescagemTotal: 1, criteria: ["victory_points", "penalties", "head_to_head", "table_points"] });
    expect(q.repescagem.map(r => r.playerId)).toEqual(["b"]);
  });
  it("applies the same order in the server projection used by scheduled draws", () => {
    const results = [row("a", 3, 100, "Outra"), row("b", 0, 20, "Outra"), row("a", 0, 100, "Outra", 2), row("b", 3, 20, undefined, 2), row("c", 3, 100, undefined, 1, "2"), row("d", 0, 10, undefined, 1, "2"), row("c", 3, 100, undefined, 2, "2"), row("d", 0, 10, undefined, 2, "2")];
    const snapshot = { tournament: { numero_rodadas: 2, direct_per_group: 1, repescagem_enabled: false, tie_breaker_order: ["victory_points", "penalties", "table_points"] }, players: ["a", "b", "c", "d"].map((id, i) => ({ id, grupo: i < 2 ? "1" : "2", eliminado: false })), results, matchups: [1, 2].flatMap(rodada => [{ fase: "Fase de Grupos", rodada, player1_id: "a", player2_id: "b" }, { fase: "Fase de Grupos", rodada, player1_id: "c", player2_id: "d" }]), statuses: [] } as unknown as TournamentSnapshot;
    expect(deriveTournament(snapshot).eligible.Final).toEqual(["b", "c"]);
    snapshot.tournament.tie_breaker_order = null;
    expect(deriveTournament(snapshot).eligible.Final).toEqual(["a", "c"]);
  });
});
