import { describe, expect, it } from "vitest";
import { computeQualifiers } from "./qualifiers";
import type { Tables } from "@/integrations/supabase/types";
const fixture = (incomplete: number[] = []) => Array.from({length: 29}, (_, g) =>
  Array.from({length: 6}, (_, i) => ({ player_id: `${g+1}-${i+1}`, grupo: String(g+1),
    fase: "Fase de Grupos", rodada: 1, pontos_jogo: 18-i*3, pontos_mesa: 1000-i*100+g,
    penalidades: incomplete.includes(g+1) && i >= 3 ? "Desistente" : "Sem penalidades",
  }))).flat() as Tables<"match_results">[];
const opts = {directPerGroup: 4, repescagemTotal: 12};
describe("preenchimento de vagas de grupos incompletos", () => {
  it("Farkle: quatro grupos com só três elegíveis completam 128 com 16 quintos", () => {
    const q = computeQualifiers(fixture([13,21,26,27]), id => id, id => id, opts);
    expect(q.direct).toHaveLength(112);
    expect(q.repescagem).toHaveLength(16);
    expect(new Set([...q.direct,...q.repescagem].map(r => r.playerId)).size).toBe(128);
    expect(q.repescagem.every(r => r.groupPosition === 5)).toBe(true);
    expect(q.repescagem[0].playerId).toBe("29-5");
    expect(q.repescagem[15].playerId).toBe("10-5");
  });
  it("preserva a regra original quando os grupos estão completos", () => {
    const q = computeQualifiers(fixture(), id => id, id => id, opts);
    expect(q.direct).toHaveLength(116); expect(q.repescagem).toHaveLength(12);
  });
  it("não inclui desistentes nem inventa vagas quando faltam elegíveis", () => {
    const q = computeQualifiers(fixture(Array.from({length:29},(_,i)=>i+1)), id=>id,id=>id,opts);
    expect(q.direct).toHaveLength(87); expect(q.repescagem).toHaveLength(0);
  });
});
