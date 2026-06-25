import type { Tables } from "@/integrations/supabase/types";
import { computeStandings, type StandingRow } from "./standings";
import { FASES } from "./constants";

type MatchResult = Tables<"match_results">;

export interface QualifierRow extends StandingRow {
  grupo: string;
  groupPosition: number;
}

export interface QualifiersResult {
  direct: QualifierRow[];        // top 5 of each group
  repescagem: QualifierRow[];    // best 18 of the 6th placed
  notQualified: QualifierRow[];  // everyone else (for reference)
  hasGroups: boolean;
}

const naturalGroupSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
};

export function computeQualifiers(
  results: MatchResult[],
  getPlayerName: (id: string) => string,
  getPlayerNick: (id: string) => string,
  opts: { directPerGroup?: number; repescagemTotal?: number } = {},
): QualifiersResult {
  const directPerGroup = opts.directPerGroup ?? 5;
  const repescagemTotal = opts.repescagemTotal ?? 18;

  const hasGroups = results.some(r => !!r.grupo && r.grupo.trim() !== "");
  if (!hasGroups) {
    const rows = computeStandings(results, getPlayerName, getPlayerNick);
    return {
      direct: rows.map(r => ({ ...r, grupo: "", groupPosition: r.position })),
      repescagem: [],
      notQualified: [],
      hasGroups: false,
    };
  }

  const groups = [...new Set(results.filter(r => r.grupo).map(r => r.grupo))].sort(naturalGroupSort);

  const direct: QualifierRow[] = [];
  const sixths: QualifierRow[] = [];
  const rest: QualifierRow[] = [];

  for (const g of groups) {
    const rows = computeStandings(
      results.filter(r => r.grupo === g),
      getPlayerName,
      getPlayerNick,
    );
    rows.forEach(r => {
      const q: QualifierRow = { ...r, grupo: g, groupPosition: r.position };
      if (r.position <= directPerGroup) direct.push(q);
      else if (r.position === directPerGroup + 1) sixths.push(q);
      else rest.push(q);
    });
  }

  // Sort 6ths cross-group by same tie-break (minus head-to-head, which is intra-group only)
  sixths.sort((a, b) => {
    if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
    if (a.pontosMesa !== b.pontosMesa) return b.pontosMesa - a.pontosMesa;
    if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
    return 0;
  });

  const repescagem = sixths.slice(0, repescagemTotal).map((r, i) => ({ ...r, position: i + 1 }));
  const remainingSixths = sixths.slice(repescagemTotal).map(r => ({ ...r }));

  // Re-position direct list across groups for display (1..N)
  direct.forEach((r, i) => { r.position = i + 1; });

  return {
    direct,
    repescagem,
    notQualified: [...remainingSixths, ...rest],
    hasGroups: true,
  };
}

export function nextPhaseName(currentFase: string): string {
  // Caminho principal ignora fases laterais como "Disputa de 3º Lugar".
  const main = FASES.filter(f => f !== "Disputa de 3º Lugar");
  const i = main.indexOf(currentFase as any);
  if (i < 0 || i === main.length - 1) return "";
  return main[i + 1];
}
