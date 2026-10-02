import { describe, expect, it } from "vitest";
import { computeEliminationQualifierIds, computeQualifiers } from "./qualifiers";
import type { Tables } from "@/integrations/supabase/types";

const matchups = [
  { fase: "Semifinal", player1_id: "a", player2_id: "b" },
  { fase: "Semifinal", player1_id: "c", player2_id: "d" },
];
const results = ["a", "b", "c", "d"].map((player_id, i) => ({
  fase: "Semifinal", player_id, pontos_jogo: i % 2 === 0 ? 3 : 0,
  pontos_mesa: 100, grupo: "", penalidades: null,
}));

describe("classificados da semifinal", () => {
  it("inclui finalistas e terceiro lugar antes de cadastrar os próximos confrontos", () => {
    expect([...computeEliminationQualifierIds(matchups, results, "Semifinal")].sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("não inclui perdedores de outras fases mesmo com terceiro lugar cadastrado", () => {
    const previous = matchups.map(m => ({ ...m, fase: "Quartas de Final" }));
    previous.push({ fase: "Disputa de 3º Lugar", player1_id: "b", player2_id: "d" });
    expect([...computeEliminationQualifierIds(previous, results.map(r => ({ ...r, fase: "Quartas de Final" })), "Quartas de Final")]).toEqual(["a", "c"]);
  });
  it("não classifica confrontos sem resultado ou empatados", () => {
    expect([...computeEliminationQualifierIds(matchups, results.slice(0, 1), "Semifinal")]).toEqual([]);
    expect([...computeEliminationQualifierIds(matchups, results.map(r => ({ ...r, pontos_jogo: 0 })), "Semifinal")]).toEqual([]);
  });
  it("mantém excluídos os desistentes e eliminados por W.O. na lista exibida", () => {
    const ids = computeEliminationQualifierIds(matchups, results, "Semifinal");
    const rows = results.filter(r => ids.has(r.player_id)).map(r => ({ ...r,
      penalidades: r.player_id === "b" ? "Desistente" : r.player_id === "d" ? "Eliminado por W.O." : null,
    })) as Tables<"match_results">[];
    expect(computeQualifiers(rows, id => id, id => id).direct.map(r => r.playerId).sort()).toEqual(["a", "c"]);
  });
});
