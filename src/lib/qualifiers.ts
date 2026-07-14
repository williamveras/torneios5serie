import type { Tables } from "@/integrations/supabase/types";
import { computeStandings, type StandingRow } from "./standings";
import { FASES } from "./constants";

type MatchResult = Tables<"match_results">;

export interface QualifierRow extends StandingRow {
  grupo: string;
  groupPosition: number;
}

export interface QualifiersResult {
  direct: QualifierRow[];        // top N of each group (+ extras que passam direto)
  repescagem: QualifierRow[];    // best (N+1)th placed que também passam direto (modo ranking)
  playoff: QualifierRow[];       // duplas que disputam a Repescagem (modo playoff)
  notQualified: QualifierRow[];  // todo o restante
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
  opts: {
    directPerGroup?: number;
    repescagemTotal?: number;
    lowerWins?: boolean;
    mode?: "ranking" | "playoff";
    playoffSize?: number;
  } = {},
): QualifiersResult {
  const directPerGroup = opts.directPerGroup ?? 5;
  const repescagemTotal = opts.repescagemTotal ?? 18;
  const lowerWins = !!opts.lowerWins;
  const mode = opts.mode ?? "ranking";
  const playoffSize = Math.max(0, opts.playoffSize ?? 0);

  const hasGroups = results.some(r => !!r.grupo && r.grupo.trim() !== "");
  if (!hasGroups) {
    const rows = computeStandings(results, getPlayerName, getPlayerNick, { lowerWins });
    return {
      direct: rows.map(r => ({ ...r, grupo: "", groupPosition: r.position })),
      repescagem: [],
      playoff: [],
      notQualified: [],
      hasGroups: false,
    };
  }

  const groups = [...new Set(results.filter(r => r.grupo).map(r => r.grupo))].sort(naturalGroupSort);

  const direct: QualifierRow[] = [];
  const extras: QualifierRow[] = []; // não-diretos, para ranking cross-grupo
  const rest: QualifierRow[] = [];

  for (const g of groups) {
    const rows = computeStandings(
      results.filter(r => r.grupo === g),
      getPlayerName,
      getPlayerNick,
      { lowerWins },
    );
    rows.forEach(r => {
      const q: QualifierRow = { ...r, grupo: g, groupPosition: r.position };
      if (r.position <= directPerGroup) direct.push(q);
      else extras.push(q);
    });
  }

  // Sort extras cross-group by tie-break (sem confronto direto — só intra-grupo)
  extras.sort((a, b) => {
    if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
    if (a.pontosMesa !== b.pontosMesa) {
      return lowerWins ? a.pontosMesa - b.pontosMesa : b.pontosMesa - a.pontosMesa;
    }
    if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
    return 0;
  });

  let repescagem: QualifierRow[] = [];
  let playoff: QualifierRow[] = [];
  let notQualified: QualifierRow[] = [];

  if (mode === "playoff") {
    // Modo fase extra: os "repescagemTotal" melhores dos extras vão DIRETO,
    // depois os "playoffSize" seguintes disputam a Repescagem (mata-mata),
    // e o resto está eliminado.
    const directExtras = extras.slice(0, repescagemTotal).map((r, i) => ({ ...r, position: direct.length + i + 1 }));
    direct.push(...directExtras);
    const afterDirect = extras.slice(repescagemTotal);
    playoff = afterDirect.slice(0, playoffSize).map((r, i) => ({ ...r, position: i + 1 }));
    notQualified = afterDirect.slice(playoffSize).map(r => ({ ...r }));
  } else {
    // Modo ranking (padrão atual): melhores (N+1)-ésimos passam direto via repescagem.
    // Apenas jogadores exatamente na posição (directPerGroup + 1) contam — os demais
    // grupos-abaixo entram em notQualified.
    const nextSlot = extras.filter(r => r.groupPosition === directPerGroup + 1);
    const others = extras.filter(r => r.groupPosition !== directPerGroup + 1);
    repescagem = nextSlot.slice(0, repescagemTotal).map((r, i) => ({ ...r, position: i + 1 }));
    const remainingSlot = nextSlot.slice(repescagemTotal);
    notQualified = [...remainingSlot, ...others];
  }
  rest.length = 0;

  // Re-position direct list across groups for display (1..N)
  direct.forEach((r, i) => { r.position = i + 1; });

  return { direct, repescagem, playoff, notQualified, hasGroups: true };
}

export function nextPhaseName(currentFase: string, mainFases?: string[] | null): string {
  // Caminho principal: usa projeção quando fornecida, senão a lista padrão
  // FASES (ignorando fases laterais como "Disputa de 3º Lugar").
  const main = mainFases && mainFases.length > 0
    ? mainFases
    : FASES.filter(f => f !== "Disputa de 3º Lugar" && f !== "Repescagem");
  const i = main.indexOf(currentFase as any);
  if (i < 0 || i === main.length - 1) return "";
  return main[i + 1];
}
