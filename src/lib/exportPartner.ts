// Exportação no formato do parceiro:
// - TXT por rodada + "resultados gerais.txt" (Fase de Grupos)
// - TXT por fase (eliminatórias)
// - XLSX estilizado por rodada / por fase
// Ver scripts de referência enviados pelo parceiro (exportar_fases.py e
// gerar_classificacao_torneio_6.py).

import JSZip from "jszip";
import * as XLSX from "xlsx-js-style";
import { formatPlayerWithTeam } from "./playerDisplay";

export interface ExpPlayer {
  id: string;
  nome_completo: string | null;
  nick_playroom: string | null;
  is_team: boolean | null;
}

export interface ExpTeamMember {
  team_id: string;
  member_nome: string;
  member_nick: string | null;
}

export interface ExpResult {
  id: string;
  player_id: string;
  fase: string;
  grupo: string;
  rodada: number;
  pontos_jogo: number;
  pontos_mesa: number;
  penalidades: string | null;
  comentario: string | null;
  data_partida: string | null;
  horario: string | null;
  created_at: string;
}

export interface ExpMatchup {
  id: string;
  fase: string | null;
  player1_id: string;
  player2_id: string;
  created_at: string;
}

const ROUND_LABELS: Record<number, string> = {
  1: "primeira", 2: "segunda", 3: "terceira", 4: "quarta", 5: "quinta",
  6: "sexta", 7: "sétima", 8: "oitava", 9: "nona", 10: "décima",
};
const roundLabel = (n: number) => ROUND_LABELS[n] ?? `${n}ª`;

const groupSortKey = (g: string): [number, string] => {
  const m = /(\d+)\s*$/.exec(g || "");
  return [m ? parseInt(m[1], 10) : 1e9, g || ""];
};

const cmpGroup = (a: string, b: string) => {
  const [an, as] = groupSortKey(a);
  const [bn, bs] = groupSortKey(b);
  if (an !== bn) return an - bn;
  return as.localeCompare(bs);
};

const parsePenalties = (raw: string | null | undefined): { count: number; note: string } => {
  const s = (raw || "").trim();
  if (!s) return { count: 0, note: "" };
  const asInt = parseInt(s, 10);
  if (!isNaN(asInt) && /^-?\d+$/.test(s)) return { count: asInt, note: "" };
  // Non-numeric (e.g. "W.O") -> count as 1 penalty with the text as note
  return { count: 1, note: s };
};

interface Agg {
  group_name: string;
  player_name: string;
  victory_points: number;
  table_points: number;
  penalties: number;
  penalty_notes: string[];
}

const sanitizePathSegment = (name: string) =>
  (name || "arquivo").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim() || "arquivo";
const sanitizeFileName = (name: string) =>
  sanitizePathSegment(name).replace(/\s+/g, "_");

// --------- Nome do jogador (respeita duplas) ---------
export const buildTeamMembersIndex = (members: ExpTeamMember[]) => {
  const idx: Record<string, { nome: string; nick: string | null }[]> = {};
  for (const m of members) {
    (idx[m.team_id] ||= []).push({ nome: m.member_nome, nick: m.member_nick });
  }
  return idx;
};

// --------- Mesa map (para fases eliminatórias) ---------
export const buildMesaMap = (matchups: ExpMatchup[], fase: string) => {
  const map = new Map<string, number>();
  matchups
    .filter((mu) => (mu.fase || "Fase de Grupos") === fase)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .forEach((mu, idx) => {
      const key = [mu.player1_id, mu.player2_id].sort().join("|");
      map.set(key, idx + 1);
    });
  return map;
};

// mesa por player_id, dentro de uma fase (via matchups)
const buildPlayerMesa = (matchups: ExpMatchup[], fase: string) => {
  const m = new Map<string, number>();
  const filtered = matchups
    .filter((mu) => (mu.fase || "Fase de Grupos") === fase)
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  filtered.forEach((mu, idx) => {
    m.set(mu.player1_id, idx + 1);
    m.set(mu.player2_id, idx + 1);
  });
  return m;
};

// --------- Agregação ---------
const aggregate = (
  rows: ExpResult[],
  playerName: (id: string) => string,
  groupOf: (r: ExpResult) => string,
): Map<string, Map<string, Agg>> => {
  const byGroup = new Map<string, Map<string, Agg>>();
  for (const r of rows) {
    const gname = groupOf(r);
    const pname = playerName(r.player_id);
    const gmap = byGroup.get(gname) ?? new Map<string, Agg>();
    if (!byGroup.has(gname)) byGroup.set(gname, gmap);
    const cur = gmap.get(pname) ?? {
      group_name: gname,
      player_name: pname,
      victory_points: 0,
      table_points: 0,
      penalties: 0,
      penalty_notes: [] as string[],
    };
    cur.victory_points += r.pontos_jogo || 0;
    cur.table_points += r.pontos_mesa || 0;
    const p = parsePenalties(r.penalidades);
    cur.penalties += p.count;
    if (p.note) cur.penalty_notes.push(p.note);
    const c = (r.comentario || "").trim();
    if (c) cur.penalty_notes.push(c);
    gmap.set(pname, cur);
  }
  return byGroup;
};

const playerSort = (a: Agg, b: Agg) => {
  if (b.victory_points !== a.victory_points) return b.victory_points - a.victory_points;
  if (b.table_points !== a.table_points) return b.table_points - a.table_points;
  const aPen = a.penalties > 0 ? 1 : 0;
  const bPen = b.penalties > 0 ? 1 : 0;
  if (aPen !== bPen) return aPen - bPen;
  if (a.penalties !== b.penalties) return a.penalties - b.penalties;
  return a.player_name.toLowerCase().localeCompare(b.player_name.toLowerCase());
};

// --------- Render TXT ---------
const renderText = (
  title: string,
  groupMap: Map<string, Map<string, Agg>>,
  showEliminated = false,
): string => {
  if (groupMap.size === 0) return "";
  const parts: string[] = [title];
  const groups = [...groupMap.keys()].sort(cmpGroup);
  for (const g of groups) {
    parts.push("");
    parts.push(`${g}:`);
    const players = [...groupMap.get(g)!.values()].sort(playerSort);
    for (const p of players) {
      parts.push(p.player_name);
      parts.push(String(p.victory_points | 0));
      parts.push(String(p.table_points | 0));
      if (showEliminated && (p.victory_points | 0) === 0) parts.push("eliminado");
      if (p.penalties > 0) parts.push(String(p.penalties));
      const notes = p.penalty_notes.filter(Boolean).join("; ");
      if (notes) parts.push(notes);
    }
  }
  return parts.join("\n").replace(/\s+$/, "") + "\n";
};

export interface BuildCtx {
  players: ExpPlayer[];
  teamMembers: ExpTeamMember[];
  matchups: ExpMatchup[];
  results: ExpResult[];
  tournamentName: string;
}

const makePlayerNameFn = (ctx: BuildCtx) => {
  const idx = buildTeamMembersIndex(ctx.teamMembers);
  const map: Record<string, ExpPlayer> = {};
  ctx.players.forEach((p) => (map[p.id] = p));
  return (id: string) => {
    const p = map[id];
    if (!p) return "Jogador desconhecido";
    return formatPlayerWithTeam(p as any, idx, "Jogador desconhecido");
  };
};

export const buildRoundTxt = (ctx: BuildCtx, round: number): string => {
  const nameFn = makePlayerNameFn(ctx);
  const rows = ctx.results.filter((r) => (r.fase || "Fase de Grupos") === "Fase de Grupos" && r.rodada === round);
  const agg = aggregate(rows, nameFn, (r) => r.grupo || "Sem grupo");
  const title = `Segue abaixo os resultados da ${roundLabel(round)} rodada, dispostos na seguinte ordem:`;
  return renderText(title, agg);
};

export const buildGeneralTxt = (ctx: BuildCtx): string => {
  const nameFn = makePlayerNameFn(ctx);
  const rows = ctx.results.filter((r) => (r.fase || "Fase de Grupos") === "Fase de Grupos");
  const agg = aggregate(rows, nameFn, (r) => r.grupo || "Sem grupo");
  return renderText("Segue abaixo os resultados gerais, dispostos na seguinte ordem:", agg);
};

export const buildPhaseTxt = (ctx: BuildCtx, fase: string): string => {
  const nameFn = makePlayerNameFn(ctx);
  const rows = ctx.results.filter((r) => (r.fase || "Fase de Grupos") === fase);
  const mesa = buildPlayerMesa(ctx.matchups, fase);
  const agg = aggregate(rows, nameFn, (r) => {
    const n = mesa.get(r.player_id);
    return n ? `Mesa ${n}` : "Mesa";
  });
  return renderText(
    `Segue abaixo os resultados da fase ${fase}, dispostos na seguinte ordem:`,
    agg,
    true,
  );
};

// --------- XLSX ---------
interface XlsxRow {
  Nome: string;
  Local: number | string;
  Data: string;
  Hora: string;
  Vitoria: number;
  Jogo: number;
  Situacao: string;
}

const formatDate = (v: string | null | undefined): string => {
  if (!v) return "";
  const s = String(v).trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[3].padStart(2, "0")}/${iso[2].padStart(2, "0")}/${iso[1]}`;
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(s);
  if (br) {
    const y = br[3] ? (br[3].length === 2 ? "20" + br[3] : br[3]) : new Date().getFullYear();
    return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}/${y}`;
  }
  return s;
};
const formatTime = (v: string | null | undefined): string => {
  if (!v) return "";
  const m = /(\d{1,2})\s*:\s*(\d{2})/.exec(String(v));
  if (!m) return String(v).trim();
  const h = parseInt(m[1], 10), min = parseInt(m[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return String(v).trim();
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};
const extractGroupNumber = (g: string): number | string => {
  const m = /\d+/.exec(g || "");
  return m ? parseInt(m[0], 10) : (g || "").trim();
};

const HEADER_FILL = { fill: { patternType: "solid", fgColor: { rgb: "1F4E78" } } };
const HEADER_FONT = { font: { color: { rgb: "FFFFFF" }, bold: true } };
const CENTER = { alignment: { horizontal: "center", vertical: "center" } };
const BORDER_SIDE = { style: "thin", color: { rgb: "D9E2F3" } };
const BORDER = {
  border: { top: BORDER_SIDE, bottom: BORDER_SIDE, left: BORDER_SIDE, right: BORDER_SIDE },
};
const HEADER_STYLE = { ...HEADER_FILL, ...HEADER_FONT, ...CENTER, ...BORDER };
const CELL_STYLE = { ...CENTER, ...BORDER };

const autoWidths = (headers: string[], rows: (string | number)[][]) => {
  return headers.map((h, i) => {
    let max = String(h).length;
    for (const r of rows) {
      const v = r[i];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 12), 45) };
  });
};

const buildRowsForPhase = (
  ctx: BuildCtx,
  fase: string,
  round: number | null,
  isGroupPhase: boolean,
): { rows: XlsxRow[]; warnings: string[] } => {
  const nameFn = makePlayerNameFn(ctx);
  const filtered = ctx.results.filter((r) => {
    if ((r.fase || "Fase de Grupos") !== fase) return false;
    if (isGroupPhase && round != null && r.rodada !== round) return false;
    return true;
  });
  const mesa = !isGroupPhase ? buildPlayerMesa(ctx.matchups, fase) : null;
  const rows: XlsxRow[] = [];
  const warnings: string[] = [];
  for (const r of filtered) {
    const nome = nameFn(r.player_id) || "";
    const local = isGroupPhase
      ? extractGroupNumber(r.grupo || "")
      : (mesa?.get(r.player_id) ?? "");
    const data = formatDate(r.data_partida);
    const hora = formatTime(r.horario);
    const vit = r.pontos_jogo || 0;
    const jogo = r.pontos_mesa || 0;
    const pen = (r.penalidades || "").trim();
    const situacao = !isGroupPhase && vit === 0 ? "eliminado" : pen;
    if (!nome) warnings.push(`Registro ${r.id}: nome do jogador vazio.`);
    if (local === "" || local == null) warnings.push(`Registro ${r.id}: ${isGroupPhase ? "grupo" : "mesa"} vazio.`);
    if (!data) warnings.push(`Registro ${r.id}: data vazia.`);
    if (!hora) warnings.push(`Registro ${r.id}: hora vazia.`);
    rows.push({ Nome: nome, Local: local, Data: data, Hora: hora, Vitoria: vit, Jogo: jogo, Situacao: situacao });
  }
  rows.sort((a, b) => {
    const la = typeof a.Local === "number" ? a.Local : 999999;
    const lb = typeof b.Local === "number" ? b.Local : 999999;
    if (la !== lb) return la - lb;
    if (a.Data !== b.Data) return a.Data.localeCompare(b.Data);
    if (a.Hora !== b.Hora) return a.Hora.localeCompare(b.Hora);
    return a.Nome.localeCompare(b.Nome);
  });
  return { rows, warnings };
};

export const buildXlsx = (
  ctx: BuildCtx,
  fase: string,
  round: number | null,
  headerTitle: string,
): ArrayBuffer => {
  const isGroupPhase = fase === "Fase de Grupos";
  const { rows, warnings } = buildRowsForPhase(ctx, fase, round, isGroupPhase);
  const localCol = isGroupPhase ? "Grupo" : "Mesa";
  const situCol = isGroupPhase ? "Penalidades" : "Situação";
  const headers = ["Nome", localCol, "Data", "Hora", "Pontos de vitória", "Pontos de jogo", situCol];

  // Row 1: merged title. Row 2: headers. Rows 3+: data
  const aoa: (string | number)[][] = [
    [headerTitle, "", "", "", "", "", ""],
    headers,
    ...rows.map((r) => [r.Nome, r.Local, r.Data, r.Hora, r.Vitoria, r.Jogo, r.Situacao]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
  ws["!cols"] = autoWidths(headers, rows.map((r) => [r.Nome, r.Local, r.Data, r.Hora, r.Vitoria, r.Jogo, r.Situacao]));
  ws["!freeze"] = { xSplit: 0, ySplit: 2 } as any;
  ws["!autofilter"] = { ref: `A2:${String.fromCharCode(64 + headers.length)}${aoa.length}` };

  // Apply styles
  for (let c = 0; c < headers.length; c++) {
    const c1 = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[c1]) ws[c1].s = HEADER_STYLE;
    const c2 = XLSX.utils.encode_cell({ r: 1, c });
    if (ws[c2]) ws[c2].s = HEADER_STYLE;
  }
  for (let r = 2; r < aoa.length; r++) {
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = CELL_STYLE;
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Classificação");

  if (warnings.length > 0) {
    const wsA = XLSX.utils.aoa_to_sheet([["Aviso"], ...warnings.map((w) => [w])]);
    wsA["!cols"] = autoWidths(["Aviso"], warnings.map((w) => [w]));
    wsA["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
    wsA["!autofilter"] = { ref: `A1:A${warnings.length + 1}` };
    const h = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (wsA[h]) wsA[h].s = HEADER_STYLE;
    for (let r = 1; r <= warnings.length; r++) {
      const a = XLSX.utils.encode_cell({ r, c: 0 });
      if (wsA[a]) wsA[a].s = CELL_STYLE;
    }
    XLSX.utils.book_append_sheet(wb, wsA, "Avisos");
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
};

// --------- ZIP master ---------
export interface ZipOptions {
  ctx: BuildCtx;
  groupsRounds: number[]; // rounds a incluir da Fase de Grupos
  elimPhases: string[]; // nomes exatos das fases eliminatórias a incluir
  includeGroupsGeneral: boolean;
}

export const buildZip = async (opts: ZipOptions): Promise<Blob> => {
  const zip = new JSZip();
  const { ctx } = opts;

  // ---- Fase de Grupos ----
  if (opts.groupsRounds.length > 0 || opts.includeGroupsGeneral) {
    const txtDir = zip.folder("txt")!.folder("Fase de Grupos")!;
    const xlsxDir = zip.folder("xlsx")!.folder("Fase de Grupos")!;
    for (const r of opts.groupsRounds) {
      const txt = buildRoundTxt(ctx, r);
      if (txt.trim()) txtDir.file(`rodada${r}.txt`, txt);
      const buf = buildXlsx(ctx, "Fase de Grupos", r, `Classificação - Rodada ${r}`);
      xlsxDir.file(`Rodada ${r}.xlsx`, buf);
    }
    if (opts.includeGroupsGeneral) {
      const txt = buildGeneralTxt(ctx);
      if (txt.trim()) txtDir.file("resultados gerais.txt", txt);
    }
  }

  // ---- Eliminatórias ----
  const txtRoot = zip.folder("txt")!;
  const xlsxRoot = zip.folder("xlsx")!;
  for (const fase of opts.elimPhases) {
    const txt = buildPhaseTxt(ctx, fase);
    if (txt.trim()) txtRoot.file(`${sanitizeFileName(fase)}.txt`, txt);
    const buf = buildXlsx(ctx, fase, null, `Classificação - ${fase}`);
    xlsxRoot.file(`${sanitizePathSegment(fase)}.xlsx`, buf);
  }

  return await zip.generateAsync({ type: "blob" });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
