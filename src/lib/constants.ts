export const FASES = [
  "Fase de Grupos",
  "Repescagem",
  "Segunda Fase",
  "Terceira Fase",
  "16 Avos",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Disputa de 3º Lugar",
  "Final",
] as const;

export type Fase = (typeof FASES)[number];

/**
 * "Disputa de 3º Lugar" é uma fase paralela à Final: opcional, jogada apenas
 * em torneios que premiam o 3º lugar. Não faz parte do caminho principal do
 * chaveamento (Semifinal -> Final), portanto é ignorada pelas funções que
 * calculam a "próxima fase" e a "fase ativa" do torneio.
 *
 * "Repescagem" é opcional (só entra no fluxo quando `repescagem_mode = 'playoff'`
 * no torneio). É tratada como fase condicional em `buildMainFases`.
 */
export const SIDE_FASES: readonly string[] = ["Disputa de 3º Lugar"];
export const isSideFase = (fase: string) => SIDE_FASES.includes(fase);
