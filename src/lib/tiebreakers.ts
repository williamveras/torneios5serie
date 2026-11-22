export const criterionLabels = {
  victory_points: "Pontos de vitória",
  wins: "Número de vitórias",
  penalties: "Penalidades sofridas",
  table_points: "Pontos de mesa",
  head_to_head: "Confronto direto",
};
export type Criterion = keyof typeof criterionLabels;
export function validCriteria(value?: readonly string[] | null): value is Criterion[] {
  return !!value?.length && value[0] === "victory_points" && value.length <= 5 && new Set(value).size === value.length && value.every(k => Object.prototype.hasOwnProperty.call(criterionLabels, k));
}
export function defaultCriteria(h2hFirst = false): Criterion[] {
  return h2hFirst ? ["victory_points", "head_to_head", "table_points", "penalties"] : ["victory_points", "table_points", "penalties", "head_to_head"];
}
