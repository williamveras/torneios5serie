// Helpers to compute the current round of the Fase de Grupos based on
// scheduled matchups + registered results.

export interface MatchupLite {
  player1_id: string;
  player2_id: string;
  rodada: number | null;
  fase?: string | null;
}

export interface ResultLite {
  player_id: string;
  rodada: number;
  fase?: string | null;
}

export interface RoundState {
  rodada: number;
  totalJogos: number;
  jogosConcluidos: number;
  isComplete: boolean;
}

export interface RoundsComputation {
  totalRounds: number | null;
  currentRound: number | null;
  phaseComplete: boolean;
  roundsState: RoundState[];
}

const FASE_GRUPOS = "Fase de Grupos";

function pairKey(a: string, b: string) {
  return [a, b].sort().join("|");
}

/**
 * Computes the state of every round in the Fase de Grupos.
 *
 * A "game" is one matchup (a pair of players in a given round).
 * A game is "concluído" when both players have a result row in `match_results`
 * for that same round.
 *
 * - currentRound: the smallest round that is not yet complete.
 *   If all rounds are complete, returns totalRounds.
 *   Fallback when numeroRodadas is null: max(matchups.rodada) (legacy behavior).
 * - phaseComplete: true when every round 1..totalRounds is complete.
 */
export function computeCurrentRound(
  matchups: MatchupLite[],
  results: ResultLite[],
  numeroRodadas: number | null | undefined,
): RoundsComputation {
  // Only Fase de Grupos counts here. Treat missing fase as Fase de Grupos.
  const grupoMatchups = matchups.filter(
    (m) => !m.fase || m.fase === FASE_GRUPOS,
  );
  const grupoResults = results.filter(
    (r) => !r.fase || r.fase === FASE_GRUPOS,
  );

  // Legacy fallback when numero_rodadas isn't set on the tournament
  if (!numeroRodadas || numeroRodadas < 1) {
    const rounds = grupoMatchups
      .map((m) => m.rodada)
      .filter((r): r is number => r != null);
    const currentRound = rounds.length ? Math.max(...rounds) : null;
    return {
      totalRounds: null,
      currentRound,
      phaseComplete: false,
      roundsState: [],
    };
  }

  const totalRounds = numeroRodadas;
  const roundsState: RoundState[] = [];

  for (let r = 1; r <= totalRounds; r++) {
    const roundMatchups = grupoMatchups.filter((m) => m.rodada === r);
    const totalJogos = roundMatchups.length;

    // Set of player_ids that have a result in this round
    const playersWithResult = new Set(
      grupoResults.filter((res) => res.rodada === r).map((res) => res.player_id),
    );

    let jogosConcluidos = 0;
    for (const m of roundMatchups) {
      if (
        playersWithResult.has(m.player1_id) &&
        playersWithResult.has(m.player2_id)
      ) {
        jogosConcluidos++;
      }
    }

    roundsState.push({
      rodada: r,
      totalJogos,
      jogosConcluidos,
      // A round with no matchups is treated as "nothing to do" → complete
      // so we don't get stuck waiting on rounds that were never generated.
      isComplete: totalJogos === 0 || jogosConcluidos === totalJogos,
    });
  }

  // currentRound: first round that actually has matchups and isn't complete.
  // If every round with matchups is complete, fall back to the last round
  // that has matchups (or totalRounds if none exist yet).
  const firstIncomplete = roundsState.find(
    (rs) => rs.totalJogos > 0 && !rs.isComplete,
  );
  // Phase only counts as complete when every configured round has matchups
  // AND all of them are finished — otherwise empty rounds would falsely
  // close the phase before the games are actually generated.
  const phaseComplete = roundsState.every(
    (rs) => rs.totalJogos > 0 && rs.jogosConcluidos === rs.totalJogos,
  );
  const lastWithMatchups = [...roundsState]
    .reverse()
    .find((rs) => rs.totalJogos > 0);
  const currentRound = firstIncomplete
    ? firstIncomplete.rodada
    : lastWithMatchups
      ? lastWithMatchups.rodada
      : totalRounds;


  return { totalRounds, currentRound, phaseComplete, roundsState };
}
