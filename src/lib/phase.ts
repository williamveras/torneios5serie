import { FASES, isSideFase } from "./constants";
import { projectPhases } from "./phaseProjection";

export interface PhaseStatusLite { fase: string; status: string; }

/**
 * Build the projected "main" phase sequence for a tournament starting from
 * "Fase de Grupos". When the number of qualifiers is known (directPerGroup,
 * numGroups, optional repescagem), it uses projectPhases to pick the right
 * elimination names (Quartas/Semi/Final) and skips generic "Segunda Fase" /
 * "Terceira Fase" in smaller brackets. Returns null when not computable.
 */
export function buildMainFases(opts: {
  directPerGroup?: number | null;
  repescagemTotal?: number | null;
  numGroups?: number | null;
}): string[] | null {
  const dpg = opts.directPerGroup ?? null;
  const ng = opts.numGroups ?? null;
  if (!dpg || !ng || ng < 1) return null;
  const rep = opts.repescagemTotal ?? 0;
  const total = dpg * ng + (rep > 0 ? rep : 0);
  const proj = projectPhases(total);
  if (proj.length === 0) return null;
  return ["Fase de Grupos", ...proj.map(p => p.fase)];
}

/**
 * Public-facing "current" phase. When `mainFases` is provided, it uses that
 * projected sequence; otherwise falls back to the static FASES (excluding
 * side phases like "Disputa de 3º Lugar").
 */
export const getActivePublicPhase = (
  statuses: PhaseStatusLite[],
  mainFases?: string[] | null,
): string => {
  const main = mainFases && mainFases.length > 0
    ? mainFases
    : FASES.filter(f => !isSideFase(f));
  let lastConcludedIdx = -1;
  for (let i = 0; i < main.length; i++) {
    if (statuses.find(s => s.fase === main[i])?.status === "concluida") lastConcludedIdx = i;
  }
  if (lastConcludedIdx === -1) return main[0] ?? "Fase de Grupos";
  const nextIdx = Math.min(lastConcludedIdx + 1, main.length - 1);
  return main[nextIdx];
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
