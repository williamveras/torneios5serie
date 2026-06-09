// Projeção automática de fases eliminatórias a partir do número de
// classificados saídos da Fase de Grupos.
//
// Regras:
//   - Cada fase corta o número de jogadores pela metade (arredonda pra cima).
//   - Tamanhos "nomeados" mapeiam para as fases tradicionais:
//       32 -> 16 Avos
//       16 -> Oitavas de Final
//        8 -> Quartas de Final
//        4 -> Semifinal
//        2 -> Final
//   - Fases acima de 32 jogadores usam os nomes genéricos do FASES:
//       "Segunda Fase", "Terceira Fase".
//   - Em torneios menores (ex.: 16 classificados), o sistema PULA Segunda/
//     Terceira Fase e começa direto na fase nomeada correta (Oitavas).

import { FASES } from "./constants";

export interface PhaseProjection {
  fase: string;
  from: number; // jogadores que entram nesta fase
  to: number;   // jogadores que saem (avançam para a próxima)
  isFinal: boolean;
}

const NAMED: Record<number, string> = {
  32: "16 Avos",
  16: "Oitavas de Final",
  8: "Quartas de Final",
  4: "Semifinal",
  2: "Final",
};

const GENERIC_NAMES = ["Segunda Fase", "Terceira Fase"] as const;

/**
 * Retorna a sequência projetada de fases eliminatórias para `n` classificados.
 * Não inclui a Fase de Grupos.
 */
export function projectPhases(n: number): PhaseProjection[] {
  if (!Number.isFinite(n) || n < 2) return [];
  const out: PhaseProjection[] = [];
  let size = Math.floor(n);
  let genericIdx = 0;
  // Hard cap: 12 iterações é mais que suficiente (suporta até ~4096 jogadores).
  let safety = 12;
  while (size > 1 && safety-- > 0) {
    const to = Math.ceil(size / 2);
    let fase: string;
    if (NAMED[size]) {
      fase = NAMED[size];
    } else if (genericIdx < GENERIC_NAMES.length) {
      fase = GENERIC_NAMES[genericIdx++];
    } else {
      fase = `Fase intermediária ${genericIdx - GENERIC_NAMES.length + 1}`;
      genericIdx++;
    }
    out.push({ fase, from: size, to, isFinal: to === 1 });
    size = to;
  }
  return out;
}

/**
 * Encontra a projeção da fase atual. Retorna `null` se a fase não é
 * eliminatória ou não consta na projeção (ex.: torneio pequeno).
 */
export function findPhaseInProjection(
  projection: PhaseProjection[],
  fase: string,
): PhaseProjection | null {
  return projection.find(p => p.fase === fase) ?? null;
}

/**
 * Próxima fase prevista pela projeção (não usa FASES estática).
 * Retorna `null` quando a fase atual é a Final ou não está projetada.
 */
export function nextProjectedPhase(
  projection: PhaseProjection[],
  fase: string,
): PhaseProjection | null {
  const i = projection.findIndex(p => p.fase === fase);
  if (i < 0 || i === projection.length - 1) return null;
  return projection[i + 1];
}

/**
 * Re-exporta FASES por conveniência.
 */
export { FASES };
