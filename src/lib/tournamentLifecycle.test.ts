import { describe, it, expect } from "vitest";
import { deriveTournament, type TournamentSnapshot } from "./tournamentLifecycle";
import { buildMesaMap } from "./phase";

function fixture(): TournamentSnapshot {
  return {
    tournament: { elimination_only: true, lower_score_wins: false } as TournamentSnapshot["tournament"],
    players: ["a", "b", "c", "d"].map(id => ({id, eliminado: false})) as TournamentSnapshot["players"],
    matchups: [
      {fase: "Semifinal", player1_id: "a", player2_id: "b"},
      {fase: "Semifinal", player1_id: "c", player2_id: "d"},
    ] as TournamentSnapshot["matchups"],
    results: [], statuses: [],
  };
}
const score = (player_id: string, pontos_jogo: number, fase = "Semifinal") =>
  ({player_id, pontos_jogo, pontos_mesa: 100, fase, penalidades: "Sem penalidades"}) as TournamentSnapshot["results"][number];

describe("server tournament lifecycle", () => {
  it("does not advance incomplete or tied matches", () => {
    const s = fixture(); s.results = [score("a", 3), score("b", 0), score("c", 0), score("d", 0)];
    const p = deriveTournament(s);
    expect(p.phases.Semifinal).toBe(false);
    expect(p.eligible.Final).toBeUndefined();
  });
  it("sends winners to final and only semifinal losers to third place", () => {
    const s = fixture(); s.results = [score("a", 3), score("b", 0), score("c", 3), score("d", 0)];
    const p = deriveTournament(s);
    expect(p.eligible.Final).toEqual(["a", "c"]);
    expect(p.eligible["Disputa de 3º Lugar"]).toEqual(["b", "d"]);
  });
  it("recomputes champion after correction and clears it after result deletion", () => {
    const s = fixture(); s.results = [score("a", 3), score("b", 0), score("c", 3), score("d", 0), score("a", 3, "Final"), score("c", 0, "Final")];
    s.matchups.push({fase: "Final", player1_id: "a", player2_id: "c"} as TournamentSnapshot["matchups"][number]);
    expect(deriveTournament(s).champion).toBe("a");
    s.results[5].pontos_jogo = 6;
    expect(deriveTournament(s).champion).toBe("c");
    s.results.pop();
    expect(deriveTournament(s).champion).toBeNull();
    expect(deriveTournament(s).phases.Final).toBe(false);
  });
  it("reports later draw conflicts without rewriting the matches", () => {
    const s = fixture(); s.results = [score("a", 0), score("b", 3), score("c", 3), score("d", 0)];
    s.matchups.push({fase: "Final", player1_id: "a", player2_id: "c"} as TournamentSnapshot["matchups"][number]);
    expect(deriveTournament(s).conflicts[0]).toContain("Final");
    expect(s.matchups[2].player1_id).toBe("a");
  });
  it("does not close a phase whose draw is missing a match", () => {
    const s = fixture(); s.matchups.pop(); s.results = [score("a", 3), score("b", 0)];
    const p = deriveTournament(s);
    expect(p.phases.Semifinal).toBe(false);
    expect(p.eligible.Final).toBeUndefined();
    expect(p.conflicts[0]).toContain("Semifinal");
  });
  it("does not admit a withdrawn semifinal loser to the third-place draw", () => {
    const s = fixture(); s.results = [score("a", 3), score("b", 0), score("c", 3), score("d", 0)];
    s.players[1].elimination_reason = "withdrawal";
    expect(deriveTournament(s).eligible["Disputa de 3º Lugar"]).toEqual(["d"]);
    expect(deriveTournament(s).expected["Disputa de 3º Lugar"]).toBe(2);
  });
  it("uses persisted mesa numbers regardless of input order or publication subset", () => {
    const matches = [
      {id:"1",fase:"Final",player1_id:"a",player2_id:"b",created_at:"2026-01-01",mesa_numero:9},
      {id:"2",fase:"Final",player1_id:"c",player2_id:"d",created_at:"2026-01-01",mesa_numero:4},
    ];
    expect(buildMesaMap(matches, "Final").get("a|b")).toBe(9);
    expect(buildMesaMap(matches.reverse(), "Final").get("a|b")).toBe(9);
    expect(buildMesaMap([matches[0]], "Final").get("c|d")).toBe(4);
  });
});
