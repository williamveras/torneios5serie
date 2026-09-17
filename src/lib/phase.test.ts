import { describe, expect, it } from "vitest";
import { buildMainFases, getActivePublicPhase } from "./phase";
import { projectPhases } from "./phaseProjection";
import { countMainQualifiers, nextPhaseName, type QualifiersResult, type QualifierRow } from "./qualifiers";

const milhas = { directPerGroup: 3, numGroups: 25, repescagemTotal: 21,
  repescagemMode: "playoff" as const, repescagemPlayoffSize: 64, byePosition: 2, byeTotal: 7 };

describe("nomes das fases por vagas", () => {
  it("1000 Milhas: 32 byes + 32 vencedores, depois 16 Avos", () => {
    const fases = buildMainFases(milhas)!;
    expect(fases).toEqual(["Fase de Grupos", "Repescagem", "Segunda Fase", "16 Avos", "Oitavas de Final", "Quartas de Final", "Semifinal", "Final"]);
    expect(nextPhaseName("Segunda Fase", fases)).toBe("16 Avos");
    expect(getActivePublicPhase([{fase: "Segunda Fase", status: "concluida"}], fases)).toBe("16 Avos");
    expect(nextPhaseName("16 Avos", fases)).toBe("Oitavas de Final");
  });
  it("preserva o caminho de 128 participantes do Farkle e Scopas", () => {
    expect(buildMainFases({directPerGroup: 4, numGroups: 29, repescagemTotal: 12}))
      .toEqual(["Fase de Grupos", "Segunda Fase", "Terceira Fase", "16 Avos", "Oitavas de Final", "Quartas de Final", "Semifinal", "Final"]);
    expect(buildMainFases({directPerGroup: null, numGroups: 22})).toBeNull();
  });
  it.each([[32, "16 Avos"], [16, "Oitavas de Final"], [8, "Quartas de Final"], [4, "Semifinal"], [2, "Final"]])("%i participantes começam em %s", (n, name) => {
    expect(projectPhases(n as number)[0].fase).toBe(name);
    expect(buildMainFases({eliminationOnly: true,totalParticipants: n as number})![0]).toBe(name);
  });
  it("inclui só vencedores da repescagem e não duplica os byes", () => {
    const row = (n: number) => ({playerId: String(n)}) as QualifierRow;
    const q: QualifiersResult = {direct: Array.from({length:75}, (_, i) => row(i)),
      repescagem: Array.from({length:7}, (_, i) => row(25+i)),
      playoff: Array.from({length:64}, (_, i) => row(32+i)),
      notQualified: [], hasGroups: true, nextSlotPosition: 2};
    expect(countMainQualifiers(q)).toBe(64);
    expect(projectPhases(countMainQualifiers(q))[1].fase).toBe("16 Avos");
  });
  it("mantém repescagem simples e torneios pequenos", () => {
    expect(buildMainFases({directPerGroup:1,numGroups:8,repescagemTotal:0})![1]).toBe("Quartas de Final");
    expect(buildMainFases({directPerGroup:2,numGroups:4,repescagemTotal:4,repescagemMode:"playoff",repescagemPlayoffSize:8})![2]).toBe("Oitavas de Final");
  });
});
