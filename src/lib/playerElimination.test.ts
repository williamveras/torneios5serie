import { describe, expect, it } from "vitest";
import { applyPlayerEliminations } from "./playerElimination";
import { computeStandings } from "./standings";
import { computeQualifiers } from "./qualifiers";
import type { Tables } from "@/integrations/supabase/types";
const rows = [
  { player_id: "out", pontos_jogo: 30, pontos_mesa: 9000, penalidades: "Sem penalidades", grupo: "1", fase: "Fase de Grupos", rodada: 1 },
  { player_id: "active", pontos_jogo: 3, pontos_mesa: 100, penalidades: "Sem penalidades", grupo: "1", fase: "Fase de Grupos", rodada: 1 },
] as Tables<"match_results">[];
describe("eliminação por desistência", () => {
  it.each([false, true])("fica abaixo de quem continua jogando (menor pontuação vence: %s)", lowerWins => {
    const adjusted = applyPlayerEliminations(rows, [{id: "out", eliminado: true, elimination_reason: "withdrawal"}]);
    expect(computeStandings(adjusted, id => id, id => id, {lowerWins}).map(r => r.playerId)).toEqual(["active", "out"]);
    expect(computeQualifiers(adjusted, id => id, id => id, {directPerGroup: 1}).direct.map(r => r.playerId)).toEqual(["active"]);
    expect(rows[0].penalidades).toBe("Sem penalidades");
    expect(adjusted[0].pontos_jogo).toBe(30);
  });
  it("reverter a marcação restaura a classificação sem alterar resultados", () => {
    const adjusted = applyPlayerEliminations(rows, [{id: "out", eliminado: false, elimination_reason: null}]);
    expect(computeStandings(adjusted, id => id, id => id)[0].playerId).toBe("out");
  });
  it("não confunde eliminação normal de fase com desistência", () => {
    expect(applyPlayerEliminations(rows, [{id: "out", eliminado: true, elimination_reason: null}])).toEqual(rows);
  });
});
