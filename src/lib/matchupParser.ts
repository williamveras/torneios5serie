// Parser for raw text describing matchups + schedules.
// Extracts grupo, players, optional date+time or observation per match.

export interface ParsedMatchup {
  grupo: string;
  player1Name: string;
  player2Name: string;
  player1Id?: string;
  player2Id?: string;
  data?: string; // ISO YYYY-MM-DD
  horario?: string; // HH:MM
  observacao?: string;
  errors: string[];
}

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

const OBS_KEYWORDS = /\b(a\s+definir|w\.?\s*o|wo|bye|adiad[oa]|cancelad[oa])\b/i;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function findPlayer(name: string, players: PlayerLite[]): PlayerLite | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return (
    players.find((p) => norm(p.nick_playroom || "") === n) ||
    players.find((p) => norm(p.nome_completo) === n) ||
    players.find((p) => norm(p.nick_playroom || "").includes(n) || n.includes(norm(p.nick_playroom || ""))) ||
    players.find((p) => norm(p.nome_completo).includes(n))
  );
}

function parseGroupHeader(line: string): string | null {
  const m = line.match(/^\s*grupo\s+(\d+)\s*:?\s*$/i);
  return m ? m[1] : null;
}

function parseMatchLine(line: string): { p1: string; p2: string } | null {
  // Match "A x B" or "A vs B" with whitespace around separator
  const m = line.match(/^\s*(.+?)\s+(?:x|vs|×|✕)\s+(.+?)\s*$/i);
  if (!m) return null;
  const p1 = m[1].trim();
  const p2 = m[2].trim();
  // Reject if either side contains a digit-heavy date pattern (likely not a name)
  if (!p1 || !p2) return null;
  return { p1, p2 };
}

function parseDateTimeLine(line: string): { data?: string; horario?: string } {
  const result: { data?: string; horario?: string } = {};
  const dateMatch = line.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : new Date().getFullYear();
    if (year < 100) year += 2000;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const d = new Date(year, month - 1, day);
      if (d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day) {
        result.data = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
    }
  }
  const timeMatch = line.match(/(\d{1,2})[:hH](\d{2})/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const mm = parseInt(timeMatch[2], 10);
    if (h >= 0 && h < 24 && mm >= 0 && mm < 60) {
      result.horario = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    }
  }
  return result;
}

export function parseMatchupsText(text: string, players: PlayerLite[]): ParsedMatchup[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const results: ParsedMatchup[] = [];
  let currentGrupo = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const g = parseGroupHeader(line);
    if (g) {
      currentGrupo = g;
      continue;
    }

    const match = parseMatchLine(line);
    if (!match) continue;

    const errors: string[] = [];
    const p1 = findPlayer(match.p1, players);
    const p2 = findPlayer(match.p2, players);
    if (!p1) errors.push(`Jogador "${match.p1}" não encontrado`);
    if (!p2) errors.push(`Jogador "${match.p2}" não encontrado`);
    if (!currentGrupo) errors.push("Grupo não definido (adicione cabeçalho 'Grupo N')");

    const parsed: ParsedMatchup = {
      grupo: currentGrupo,
      player1Name: match.p1,
      player2Name: match.p2,
      player1Id: p1?.id,
      player2Id: p2?.id,
      errors,
    };

    // Look ahead to next non-empty line for date/time or observation
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    if (j < lines.length) {
      const next = lines[j];
      // Don't consume if next line is a group header or another matchup
      if (!parseGroupHeader(next) && !parseMatchLine(next)) {
        if (OBS_KEYWORDS.test(next)) {
          parsed.observacao = next;
          i = j;
        } else {
          const dt = parseDateTimeLine(next);
          if (dt.data || dt.horario) {
            parsed.data = dt.data;
            parsed.horario = dt.horario;
            i = j;
          }
        }
      }
    }

    results.push(parsed);
  }

  return results;
}
