export const criterionLabels = {
  victory_points: "Pontos de vitória",
  wins: "Número de vitórias",
  penalties: "Menos penalidades sofridas",
  table_points: "Pontos de mesa",
  head_to_head: "Confronto direto",
  penalty_presence: "Ausência de penalidades (regra antiga)",
};
export type Criterion = keyof typeof criterionLabels;
export function validCriteria(value?: readonly string[] | null): value is Criterion[] {
  return !!value?.length && value[0] === "victory_points" && value.length <= 6 && new Set(value).size === value.length && value.every(k => Object.prototype.hasOwnProperty.call(criterionLabels, k));
}
export function legacyCriteria(h2hFirst = false): Criterion[] {
  return h2hFirst ? ["victory_points", "head_to_head", "table_points", "penalty_presence"] : ["victory_points", "table_points", "penalty_presence", "head_to_head"];
}
