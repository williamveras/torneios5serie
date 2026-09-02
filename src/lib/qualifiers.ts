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
  nextSlotPosition: number;      // posição de grupo que disputa a repescagem (N+1)
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
    /** Quando true, o confronto direto vira o 2º critério de desempate (antes dos pontos de mesa). */
    h2hFirst?: boolean;
    mode?: "ranking" | "playoff";
    playoffSize?: number;
    /** Posição de grupo usada para o ranking dos "melhores Xº colocados". */
    byePosition?: number;
    /** Quantos melhores "byePosition"-ésimos passam direto (sem repescagem). */
    byeTotal?: number;
  } = {},
): QualifiersResult {
  const directPerGroup = opts.directPerGroup ?? 5;
  const repescagemTotal = opts.repescagemTotal ?? 18;
  const lowerWins = !!opts.lowerWins;
  const h2hFirst = !!opts.h2hFirst;
  const mode = opts.mode ?? "ranking";
  const playoffSize = Math.max(0, opts.playoffSize ?? 0);
  const byeTotal = Math.max(0, opts.byeTotal ?? 0);
  const byePosition = opts.byePosition && opts.byePosition > 0 ? opts.byePosition : directPerGroup + 1;


  const hasGroups = results.some(r => !!r.grupo && r.grupo.trim() !== "");
  if (!hasGroups) {
    const rows = computeStandings(results, getPlayerName, getPlayerNick, { lowerWins, h2hFirst });
    const eligible = rows.filter(r => r.penalidades !== "Eliminado por W.O");
    const wo = rows.filter(r => r.penalidades === "Eliminado por W.O");
    return {
      direct: eligible.map((r, i) => ({ ...r, position: i + 1, grupo: "", groupPosition: i + 1 })),
      repescagem: [],
      playoff: [],
      notQualified: wo.map((r, i) => ({ ...r, grupo: "", groupPosition: eligible.length + i + 1 })),
      hasGroups: false,
      nextSlotPosition: directPerGroup + 1,
    };
  }


  const groups = [...new Set(results.filter(r => r.grupo).map(r => r.grupo))].sort(naturalGroupSort);

  const direct: QualifierRow[] = [];
  const extras: QualifierRow[] = []; // não-diretos, para ranking cross-grupo
  const all: QualifierRow[] = [];    // todos os elegíveis, com posição de grupo
  const rest: QualifierRow[] = [];

  // Jogadores eliminados por W.O nunca se classificam.
  const isWO = (r: StandingRow) => r.penalidades === "Eliminado por W.O";

  for (const g of groups) {
    const rows = computeStandings(
      results.filter(r => r.grupo === g),
      getPlayerName,
      getPlayerNick,
      { lowerWins, h2hFirst },
    );
    // Reposiciona ignorando os eliminados por W.O, para que as vagas
    // sejam preenchidas apenas por quem continua no torneio.
    const eligible = rows.filter(r => !isWO(r));
    const woRows = rows.filter(isWO);
    eligible.forEach((r, i) => {
      const q: QualifierRow = { ...r, position: i + 1, grupo: g, groupPosition: i + 1 };
      all.push(q);
      if (i + 1 <= directPerGroup) direct.push(q);
      else extras.push(q);
    });
    woRows.forEach((r, i) => {
      rest.push({ ...r, grupo: g, groupPosition: eligible.length + i + 1 });
    });
  }

  // Tie-break cross-grupo (sem confronto direto — só intra-grupo)
  const crossSort = (a: QualifierRow, b: QualifierRow) => {
    if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
    if (a.pontosMesa !== b.pontosMesa) {
      return lowerWins ? a.pontosMesa - b.pontosMesa : b.pontosMesa - a.pontosMesa;
    }
    if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
    return 0;
  };
  extras.sort(crossSort);

  let repescagem: QualifierRow[] = [];
  let playoff: QualifierRow[] = [];
  let notQualified: QualifierRow[] = [];

  if (mode === "playoff" && byeTotal > 0 && opts.byePosition) {
    // Regulamento tipo "1000 Milhas": o total de classificados é
    // (directPerGroup por grupo) + (repescagemTotal melhores (N+1)-ésimos).
    // Dentro desse conjunto, passam direto os 1ºs de cada grupo e os
    // "byeTotal" melhores "byePosition"-ésimos; todos os demais disputam a
    // fase extra de Repescagem.
    const extraQualified = extras.filter(r => r.groupPosition === directPerGroup + 1).slice(0, repescagemTotal);
    const qualifiedPool = [...direct, ...extraQualified];
    repescagem = qualifiedPool
      .filter(r => r.groupPosition === byePosition)
      .sort(crossSort)
      .slice(0, byeTotal)
      .map((r, i) => ({ ...r, position: i + 1 }));
    const autoIds = new Set(repescagem.map(r => r.playerId));
    qualifiedPool.filter(r => r.groupPosition === 1).forEach(r => autoIds.add(r.playerId));
    playoff = qualifiedPool
      .filter(r => !autoIds.has(r.playerId))
      .sort(crossSort)
      .map((r, i) => ({ ...r, position: i + 1 }));
    const inPool = new Set(qualifiedPool.map(r => r.playerId));
    notQualified = extras.filter(r => !inPool.has(r.playerId)).map(r => ({ ...r }));
  } else if (mode === "playoff") {
    // Modo fase extra simples: os melhores "byePosition"-ésimos passam direto
    // e os "playoffSize" seguintes disputam a Repescagem.
    const nextSlot = extras.filter(r => r.groupPosition === byePosition);
    const others = extras.filter(r => r.groupPosition !== byePosition);
    repescagem = nextSlot.slice(0, repescagemTotal).map((r, i) => ({ ...r, position: i + 1 }));
    const afterDirect = [...nextSlot.slice(repescagemTotal), ...others].sort(crossSort);
    playoff = (playoffSize > 0 ? afterDirect.slice(0, playoffSize) : afterDirect).map((r, i) => ({ ...r, position: i + 1 }));
    notQualified = playoffSize > 0 ? afterDirect.slice(playoffSize).map(r => ({ ...r })) : [];
  } else {


    // Modo ranking (padrão atual): melhores (N+1)-ésimos passam direto via repescagem.
    // Apenas jogadores exatamente na posição (directPerGroup + 1) contam — os demais
    // grupos-abaixo entram em notQualified.
    const nextSlot = extras.filter(r => r.groupPosition === byePosition);
    const others = extras.filter(r => r.groupPosition !== byePosition);
    repescagem = nextSlot.slice(0, repescagemTotal).map((r, i) => ({ ...r, position: i + 1 }));
    const remainingSlot = nextSlot.slice(repescagemTotal);
    notQualified = [...remainingSlot, ...others];
  }
  notQualified = [...notQualified, ...rest];

  // Re-position direct list across groups for display (1..N)
  direct.forEach((r, i) => { r.position = i + 1; });

  return { direct, repescagem, playoff, notQualified, hasGroups: true, nextSlotPosition: byePosition };

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
