// Sugestões de regras de classificação para a Fase de Grupos
// dadas (N) inscritos e (G) grupos. Procura combinações que fecham
// num bracket válido (potência de 2: 64, 128, 32, 16…).

export interface QualificationSuggestion {
  directPerGroup: number;
  repescagemEnabled: boolean;
  repescagemTotal: number;
  totalClassificados: number;
  fitsBracket: boolean; // true se totalClassificados é potência de 2
  note: string;
}

const isPow2 = (n: number) => n >= 2 && (n & (n - 1)) === 0;
const nextPow2 = (n: number) => {
  let p = 2;
  while (p < n) p *= 2;
  return p;
};
const prevPow2 = (n: number) => {
  let p = 2;
  while (p * 2 <= n) p *= 2;
  return p;
};

/**
 * Gera até 4 sugestões ordenadas por preferência (que fecham bracket primeiro).
 */
export function suggestQualificationRules(
  totalInscritos: number,
  numGrupos: number,
  opts?: { unitSingular?: string; unitPlural?: string },
): QualificationSuggestion[] {
  const _unitS = opts?.unitSingular ?? "jogador";
  const _unitP = opts?.unitPlural ?? "jogadores";
  if (!Number.isFinite(totalInscritos) || !Number.isFinite(numGrupos)) return [];
  if (totalInscritos < 2 || numGrupos < 1) return [];

  const playersPerGroup = Math.floor(totalInscritos / numGrupos);
  const maxDirect = Math.max(1, playersPerGroup - 1); // sempre deixa pelo menos um eliminado

  const out: QualificationSuggestion[] = [];
  const seen = new Set<string>();
  const push = (s: QualificationSuggestion) => {
    const key = `${s.directPerGroup}|${s.repescagemEnabled}|${s.repescagemTotal}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(s);
  };

  // 1) Combinações sem repescagem que fecham bracket
  for (let k = maxDirect; k >= 1; k--) {
    const total = k * numGrupos;
    if (isPow2(total)) {
      push({
        directPerGroup: k,
        repescagemEnabled: false,
        repescagemTotal: 0,
        totalClassificados: total,
        fitsBracket: true,
        note: `${k} por grupo × ${numGrupos} grupos = ${total} (fecha em ${total})`,
      });
    }
  }

  // 2) Combinações com repescagem do (k+1)º colocado que fecham bracket
  for (let k = maxDirect - 1; k >= 1; k--) {
    const base = k * numGrupos;
    const target = nextPow2(base + 1);
    const r = target - base;
    if (r >= 1 && r <= numGrupos) {
      push({
        directPerGroup: k,
        repescagemEnabled: true,
        repescagemTotal: r,
        totalClassificados: target,
        fitsBracket: true,
        note: `${k} por grupo + ${r} melhores ${k + 1}º = ${target} (fecha em ${target})`,
      });
    }
  }

  // 3) Fallback: regra histórica (5 + 18) se ainda não há sugestões
  if (out.length === 0) {
    const base = 5 * numGrupos;
    const total = base + Math.min(18, numGrupos);
    push({
      directPerGroup: Math.min(5, maxDirect),
      repescagemEnabled: true,
      repescagemTotal: Math.min(18, numGrupos),
      totalClassificados: total,
      fitsBracket: isPow2(total),
      note: `Regra padrão: 5 por grupo + repescagem dos 6º (total ${total})`,
    });
  }

  return out.slice(0, 4);
}

export { isPow2, nextPow2, prevPow2 };
