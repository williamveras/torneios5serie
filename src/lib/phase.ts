import { FASES, isSideFase } from "./constants";

export interface PhaseStatusLite { fase: string; status: string; }

/**
 * Public-facing "current" phase:
 * - Returns the phase immediately AFTER the last phase marked "concluida",
 *   pulando fases laterais (ex.: "Disputa de 3º Lugar"), que não fazem parte
 *   do caminho principal Semifinal -> Final.
 * - If no phase concluded yet, returns "Fase de Grupos".
 * - If the last possible phase ("Final") is concluded, returns it.
 */
export const getActivePublicPhase = (statuses: PhaseStatusLite[]): string => {
  const mainFases = FASES.filter(f => !isSideFase(f));
  let lastConcludedIdx = -1;
  for (let i = 0; i < mainFases.length; i++) {
    if (statuses.find(s => s.fase === mainFases[i])?.status === "concluida") lastConcludedIdx = i;
  }
  if (lastConcludedIdx === -1) return "Fase de Grupos";
  const nextIdx = Math.min(lastConcludedIdx + 1, mainFases.length - 1);
  return mainFases[nextIdx];
};

export const isGroupPhase = (fase: string) => fase === "Fase de Grupos";

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

export interface MatchupLite {
  id: string;
  fase: string | null;
  player1_id: string;
  player2_id: string;
  created_at: string;
}

/**
 * Mesa number = ordinal position of the matchup within the given fase,
 * ordered by creation time. Returns a Map keyed by sorted-pair key.
 */
export const buildMesaMap = (matchups: MatchupLite[], fase: string): Map<string, number> => {
  const m = new Map<string, number>();
  matchups
    .filter(mu => (mu.fase || "Fase de Grupos") === fase)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((mu, idx) => {
      m.set(pairKey(mu.player1_id, mu.player2_id), idx + 1);
    });
  return m;
};
