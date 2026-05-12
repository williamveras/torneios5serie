// Parser for raw text describing match results.
// Format example:
//   Pontuações:
//   Lyly01: 26.
//   princesinha: 17.
//   Lyly01 ganhou!
//
// Multiple blocks may be separated by blank lines or by repeated "Pontuações:" headers.

export interface ParsedResultPlayer {
  rawName: string;
  playerId?: string;
  playerName: string;
  pontosMesa: number;
  pontosJogo: number; // 3 winner, 0 loser
}

export interface ParsedResult {
  players: ParsedResultPlayer[];
  winnerRawName?: string;
  grupo?: string;
  errors: string[];
}

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  grupo?: string | null;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function findPlayer(name: string, players: PlayerLite[]): PlayerLite | undefined {
  const n = norm(name);
  if (!n) return undefined;
  return (
    players.find((p) => norm(p.nick_playroom || "") === n) ||
    players.find((p) => norm(p.nome_completo) === n) ||
    players.find((p) => norm(p.nick_playroom || "").length > 0 && (norm(p.nick_playroom || "").includes(n) || n.includes(norm(p.nick_playroom || "")))) ||
    players.find((p) => norm(p.nome_completo).includes(n))
  );
}

// Line like "Name: 26" or "Name: 26."
function parseScoreLine(line: string): { name: string; score: number } | null {
  const m = line.match(/^\s*(.+?)\s*[:\-–]\s*(-?\d+)\s*\.?\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), score: parseInt(m[2], 10) };
}

// Line like "Name ganhou!" / "Name venceu" / "Name ganhou."
function parseWinnerLine(line: string): string | null {
  const m = line.match(/^\s*(.+?)\s+(?:ganhou|venceu|won)\b.*$/i);
  return m ? m[1].trim() : null;
}

export function parseResultsText(text: string, players: PlayerLite[]): ParsedResult[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^pontua[cç][oõ]es?\s*:?\s*$/i.test(l));

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isScore = parseScoreLine(line) !== null;
    const isWinner = parseWinnerLine(line) !== null;
    if (!isScore && !isWinner) continue;
    current.push(line);
    // A block is complete after a winner line
    if (isWinner) {
      blocks.push(current);
      current = [];
    }
  }
  // If still scores without winner, push as incomplete block
  if (current.length > 0) blocks.push(current);

  const results: ParsedResult[] = [];

  for (const block of blocks) {
    const errors: string[] = [];
    const scoreLines = block.map(parseScoreLine).filter(Boolean) as { name: string; score: number }[];
    const winnerLine = block.map(parseWinnerLine).find(Boolean) || undefined;

    if (scoreLines.length < 2) {
      errors.push("Bloco precisa de 2 pontuações (Jogador: número).");
    }
    if (scoreLines.length > 2) {
      errors.push("Bloco contém mais de 2 pontuações; apenas as duas primeiras serão usadas.");
    }
    const picked = scoreLines.slice(0, 2);

    const resolved = picked.map((s) => {
      const p = findPlayer(s.name, players);
      if (!p) errors.push(`Jogador "${s.name}" não encontrado.`);
      return { raw: s.name, score: s.score, player: p };
    });

    let winnerIdx = -1;
    if (winnerLine) {
      const wp = findPlayer(winnerLine, players);
      if (wp) {
        winnerIdx = resolved.findIndex((r) => r.player?.id === wp.id);
      }
      if (winnerIdx < 0) {
        // Try by raw name
        winnerIdx = resolved.findIndex((r) => norm(r.raw) === norm(winnerLine));
      }
      if (winnerIdx < 0) errors.push(`Vencedor "${winnerLine}" não corresponde aos jogadores do bloco.`);
    } else if (resolved.length === 2) {
      // Infer winner by highest score
      if (resolved[0].score !== resolved[1].score) {
        winnerIdx = resolved[0].score > resolved[1].score ? 0 : 1;
      } else {
        errors.push("Vencedor não informado e pontuações empatadas.");
      }
    }

    const grupo = resolved.find((r) => r.player?.grupo)?.player?.grupo || undefined;

    results.push({
      players: resolved.map((r, i) => ({
        rawName: r.raw,
        playerId: r.player?.id,
        playerName: r.player ? (r.player.nick_playroom || r.player.nome_completo) : r.raw,
        pontosMesa: r.score,
        pontosJogo: winnerIdx === i ? 3 : 0,
      })),
      winnerRawName: winnerLine,
      grupo: grupo || undefined,
      errors,
    });
  }

  return results;
}
