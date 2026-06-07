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
  grupo?: string | null;
}

const OBS_KEYWORDS = /\b(a\s+definir|w\.?\s*o|wo|bye|adiad[oa]|cancelad[oa])\b/i;

// Normaliza removendo TODOS os espaços internos + lowercase.
// Necessário porque alguns nicks foram cadastrados com espaço, mas a sala de
// jogos não permite espaços, então o texto colado vem sem eles.
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

interface FindResult {
  player?: PlayerLite;
  error?: string;
}

function findPlayerInGroup(name: string, pool: PlayerLite[]): FindResult {
  const n = norm(name);
  if (!n) return {};

  // 1) Igualdade exata por nick
  const exactNick = pool.filter((p) => norm(p.nick_playroom || "") === n);
  if (exactNick.length === 1) return { player: exactNick[0] };
  if (exactNick.length > 1) return { error: `Vários jogadores com nick "${name}" no grupo` };

  // 2) Igualdade exata por nome completo
  const exactName = pool.filter((p) => norm(p.nome_completo) === n);
  if (exactName.length === 1) return { player: exactName[0] };
  if (exactName.length > 1) return { error: `Vários jogadores com nome "${name}" no grupo` };

  // 3) Matching parcial - apenas com 3+ caracteres, exige unicidade
  if (n.length < 3) return {};

  const partial = pool.filter((p) => {
    const nick = norm(p.nick_playroom || "");
    const nome = norm(p.nome_completo);
    return (
      (nick.length > 0 && (nick.includes(n) || n.includes(nick))) ||
      (nome.length > 0 && nome.includes(n))
    );
  });
  if (partial.length === 1) return { player: partial[0] };
  if (partial.length > 1) {
    return { error: `"${name}" é ambíguo no grupo (${partial.length} correspondências)` };
  }
  return {};
}

function findPlayer(name: string, players: PlayerLite[], currentGrupo: string): FindResult {
  if (currentGrupo) {
    const inGroup = players.filter((p) => String(p.grupo || "") === String(currentGrupo));
    const res = findPlayerInGroup(name, inGroup);
    if (res.player || res.error) return res;

    // Não achou no grupo - verifica se existe em outro grupo, para dar erro claro
    const outside = findPlayerInGroup(name, players);
    if (outside.player) {
      return {
        error: `Jogador "${name}" pertence ao grupo ${outside.player.grupo}, não ao grupo ${currentGrupo}`,
      };
    }
    return {};
  }
  return findPlayerInGroup(name, players);
}

function parseGroupHeader(line: string): string | null {
  const m = line.match(/^\s*grupo\s+(\d+)\s*:?\s*$/i);
  return m ? m[1] : null;
}

function parseMatchLine(line: string): { p1: string; p2: string } | null {
  const m = line.match(/^\s*(.+?)\s+(?:x|vs|×|✕)\s+(.+?)\s*$/i);
  if (!m) return null;
  const p1 = m[1].trim();
  const p2 = m[2].trim();
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

export function parseMatchupsText(
  text: string,
  players: PlayerLite[],
  options: { ignoreGroups?: boolean } = {},
): ParsedMatchup[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const results: ParsedMatchup[] = [];
  let currentGrupo = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    if (!options.ignoreGroups) {
      const g = parseGroupHeader(line);
      if (g) {
        currentGrupo = g;
        continue;
      }
    }

    const match = parseMatchLine(line);
    if (!match) continue;

    const errors: string[] = [];
    const effectiveGrupo = options.ignoreGroups ? "" : currentGrupo;
    const r1 = findPlayer(match.p1, players, effectiveGrupo);
    const r2 = findPlayer(match.p2, players, effectiveGrupo);
    if (!options.ignoreGroups && !currentGrupo) errors.push("Grupo não definido (adicione cabeçalho 'Grupo N')");
    if (!r1.player) errors.push(r1.error || `Jogador "${match.p1}" não encontrado`);
    if (!r2.player) errors.push(r2.error || `Jogador "${match.p2}" não encontrado`);

    const parsed: ParsedMatchup = {
      grupo: currentGrupo,
      player1Name: match.p1,
      player2Name: match.p2,
      player1Id: r1.player?.id,
      player2Id: r2.player?.id,
      errors,
    };

    // Look ahead to next non-empty line for date/time or observation
    let j = i + 1;
    while (j < lines.length && !lines[j]) j++;
    if (j < lines.length) {
      const next = lines[j];
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
