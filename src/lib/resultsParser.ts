// Parser for raw text describing match results.
// Format example:
//   Pontuações:
//   Lyly01: 26.
//   princesinha: 17.
//   Lyly01 ganhou!

export interface ParsedResultPlayer {
  rawName: string;
  playerId?: string;
  playerName: string;
  pontosMesa: number;
  pontosJogo: number;
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
  is_team?: boolean | null;
}


// Normaliza removendo qualquer caractere não alfanumérico (espaços, pontuação,
// caracteres invisíveis como ZWSP/NBSP, vírgulas grudadas em nicks, etc.) +
// lowercase + remoção de acentos. Garante matching robusto entre o texto colado
// e os nicks/nomes cadastrados.
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

// Retorna todos os candidatos para um nome em uma pool dada, em ordem de prioridade.
function candidatesFor(name: string, pool: PlayerLite[]): PlayerLite[] {
  const n = norm(name);
  if (!n) return [];

  // Para duplas, ignoramos o nick composto ("nick1 / nick2") e comparamos só pelo nome da equipe.
  const nickOf = (p: PlayerLite) => (p.is_team ? "" : norm(p.nick_playroom || ""));

  const exactNick = pool.filter((p) => !p.is_team && nickOf(p) === n);
  if (exactNick.length > 0) return exactNick;

  const exactName = pool.filter((p) => norm(p.nome_completo) === n);
  if (exactName.length > 0) return exactName;

  if (n.length < 3) return [];

  const partial = pool.filter((p) => {
    const nick = nickOf(p);
    const nome = norm(p.nome_completo);
    return (
      (nick.length > 0 && (nick.includes(n) || n.includes(nick))) ||
      (nome.length > 0 && nome.includes(n))
    );
  });
  return partial;
}


function parseScoreLine(line: string): { name: string; score: number } | null {
  const m = line.match(/^\s*(.+?)\s*[:\-–]\s*(-?\d+)\s*\.?\s*$/);
  if (!m) return null;
  return { name: m[1].trim(), score: parseInt(m[2], 10) };
}

function parseWinnerLine(line: string): string | null {
  const m = line.match(/^\s*(.+?)\s+(?:ganhou|venceu|won)\b.*$/i);
  return m ? m[1].trim() : null;
}

export function parseResultsText(text: string, players: PlayerLite[], opts: { lowerWins?: boolean } = {}): ParsedResult[] {
  const lowerWins = !!opts.lowerWins;
  // Normaliza: quebra também em ". " (ponto seguido de espaço) para suportar
  // textos colados em uma única linha. Scores são inteiros, então é seguro.
  const normalized = text.replace(/\.\s+/g, ".\n");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .map((l) => l.replace(/^pontua[cç][oõ]es?\s*:?\s*/i, "").trim())
    .filter((l) => l.length > 0);

  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    const isScore = parseScoreLine(line) !== null;
    const isWinner = parseWinnerLine(line) !== null;
    if (!isScore && !isWinner) continue;
    current.push(line);
    if (isWinner) {
      blocks.push(current);
      current = [];
    }
  }
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

    // Candidatos brutos para cada jogador
    const cands = picked.map((s) => ({ raw: s.name, score: s.score, candidates: candidatesFor(s.name, players) }));

    // Resolução conjunta: prefere combinação onde ambos pertencem ao mesmo grupo.
    const resolved: { raw: string; score: number; player?: PlayerLite }[] = cands.map((c) => ({
      raw: c.raw,
      score: c.score,
      player: undefined,
    }));

    if (cands.length === 2 && cands[0].candidates.length > 0 && cands[1].candidates.length > 0) {
      // Gerar pares válidos (mesmo grupo, jogadores diferentes)
      const validPairs: { a: PlayerLite; b: PlayerLite; sameGroup: boolean }[] = [];
      for (const a of cands[0].candidates) {
        for (const b of cands[1].candidates) {
          if (a.id === b.id) continue;
          const sameGroup =
            a.grupo != null && b.grupo != null && String(a.grupo) === String(b.grupo);
          validPairs.push({ a, b, sameGroup });
        }
      }
      const sameGroupPairs = validPairs.filter((p) => p.sameGroup);
      if (sameGroupPairs.length === 1) {
        resolved[0].player = sameGroupPairs[0].a;
        resolved[1].player = sameGroupPairs[0].b;
      } else if (sameGroupPairs.length > 1) {
        errors.push(
          `Ambiguidade: "${cands[0].raw}" x "${cands[1].raw}" tem múltiplas combinações no mesmo grupo.`
        );
      } else if (validPairs.length === 1) {
        // Sem par no mesmo grupo - se há apenas um par possível, pega mas avisa
        resolved[0].player = validPairs[0].a;
        resolved[1].player = validPairs[0].b;
        errors.push(
          `Jogadores "${cands[0].raw}" e "${cands[1].raw}" pertencem a grupos diferentes (${validPairs[0].a.grupo} e ${validPairs[0].b.grupo}).`
        );
      } else if (validPairs.length > 1) {
        errors.push(
          `Ambiguidade entre grupos: "${cands[0].raw}" x "${cands[1].raw}" tem múltiplas combinações possíveis.`
        );
      }
    } else {
      // Fallback individual quando algum lado não tem candidatos
      cands.forEach((c, i) => {
        if (c.candidates.length === 1) resolved[i].player = c.candidates[0];
        else if (c.candidates.length > 1) {
          errors.push(`"${c.raw}" é ambíguo (${c.candidates.length} jogadores correspondem).`);
        }
      });
    }

    resolved.forEach((r) => {
      if (!r.player) errors.push(`Jogador "${r.raw}" não encontrado.`);
    });

    let winnerIdx = -1;
    if (winnerLine) {
      const winnerCands = candidatesFor(winnerLine, players);
      const wp = winnerCands.length === 1 ? winnerCands[0] : undefined;
      if (wp) {
        winnerIdx = resolved.findIndex((r) => r.player?.id === wp.id);
      }
      if (winnerIdx < 0) {
        winnerIdx = resolved.findIndex((r) => norm(r.raw) === norm(winnerLine));
      }
      if (winnerIdx < 0) errors.push(`Vencedor "${winnerLine}" não corresponde aos jogadores do bloco.`);
    } else if (resolved.length === 2) {
      if (resolved[0].score !== resolved[1].score) {
        // Quando "menor pontuação vence" (ex.: dominó), o vencedor automático
        // é o de menor pontuação. Caso contrário, é o de maior.
        if (lowerWins) {
          winnerIdx = resolved[0].score < resolved[1].score ? 0 : 1;
        } else {
          winnerIdx = resolved[0].score > resolved[1].score ? 0 : 1;
        }
      } else {
        errors.push("Vencedor não informado e pontuações empatadas.");
      }
    }

    const grupo = resolved.find((r) => r.player?.grupo)?.player?.grupo || undefined;

    results.push({
      players: resolved.map((r, i) => ({
        rawName: r.raw,
        playerId: r.player?.id,
        playerName: r.player ? (r.player.is_team ? r.player.nome_completo : (r.player.nick_playroom || r.player.nome_completo)) : r.raw,
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
