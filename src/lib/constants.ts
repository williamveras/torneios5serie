export const FASES = [
  "Fase de Grupos",
  "Segunda Fase",
  "Terceira Fase",
  "16 Avos",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Final",
] as const;

export type Fase = (typeof FASES)[number];
