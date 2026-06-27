import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Matchup = Tables<"matchups"> & { bracket_slot?: number | null };
type MatchResult = Tables<"match_results">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  is_team?: boolean | null;
}

interface Props {
  matchups: Matchup[];
  results: MatchResult[];
  players: PlayerLite[];
  /** Ordem das fases a exibir (esquerda → direita). Default: todas as fases eliminatórias presentes. */
  faseOrder?: string[];
  champion?: PlayerLite | null;
  /** Quando true, oculta jogadores ainda sem resultado registrado na fase. */
  hideUnplayed?: boolean;
  /** Título opcional acima do chaveamento. */
  title?: string;
}

const ELIM_FASES_DEFAULT = [
  "Segunda Fase",
  "Terceira Fase",
  "16 Avos",
  "Oitavas de Final",
  "Quartas de Final",
  "Semifinal",
  "Final",
];

import { getPlayerDisplayName } from "@/lib/playerDisplay";
function displayName(p: PlayerLite | undefined): string {
  return getPlayerDisplayName(p, "—");
}

interface MatchupView {
  matchup: Matchup;
  p1?: PlayerLite;
  p2?: PlayerLite;
  winnerId: string | null;
}

function computeWinner(
  m: Matchup,
  results: MatchResult[],
): string | null {
  const r1 = results.find(r => r.player_id === m.player1_id && r.fase === m.fase);
  const r2 = results.find(r => r.player_id === m.player2_id && r.fase === m.fase);
  if (!r1 || !r2) return null;
  if (r1.pontos_jogo > r2.pontos_jogo) return m.player1_id;
  if (r2.pontos_jogo > r1.pontos_jogo) return m.player2_id;
  if (r1.pontos_mesa > r2.pontos_mesa) return m.player1_id;
  if (r2.pontos_mesa > r1.pontos_mesa) return m.player2_id;
  return null;
}

export default function BracketView({ matchups, results, players, faseOrder, champion, hideUnplayed, title }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const columns = useMemo(() => {
    const fases = faseOrder ?? ELIM_FASES_DEFAULT;
    return fases
      .map(fase => {
        const ms = matchups
          .filter(m => m.fase === fase)
          .slice()
          .sort((a, b) => {
            const sa = (a as any).bracket_slot ?? 999999;
            const sb = (b as any).bracket_slot ?? 999999;
            if (sa !== sb) return sa - sb;
            return a.created_at.localeCompare(b.created_at);
          });
        if (ms.length === 0) return null;
        const playedIds = new Set(
          results.filter(r => r.fase === fase).map(r => r.player_id),
        );
        let views: MatchupView[] = ms.map(m => ({
          matchup: m,
          p1: playerMap.get(m.player1_id),
          p2: playerMap.get(m.player2_id),
          winnerId: computeWinner(m, results),
        }));
        if (hideUnplayed) {
          views = views.filter(
            v => playedIds.has(v.matchup.player1_id) || playedIds.has(v.matchup.player2_id),
          );
          if (views.length === 0) return null;
        }
        return { fase, views, playedIds };
      })
      .filter((c): c is { fase: string; views: MatchupView[]; playedIds: Set<string> } => c !== null);
  }, [matchups, results, playerMap, faseOrder, hideUnplayed]);

  if (columns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
          <p>Nenhuma fase eliminatória gerada ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {title && (
        <h2 className="text-lg font-semibold">{title}</h2>
      )}
      {champion && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-medium">
          🏆 Campeão: {displayName(champion)}
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-2" role="list" aria-label="Chaveamento das fases eliminatórias">
          {columns.map(col => (
            <section key={col.fase} className="flex-1 min-w-[14rem]" role="listitem">
              <h3 className="font-semibold text-sm mb-2 text-center text-muted-foreground uppercase tracking-wide">
                {col.fase}
              </h3>
              <ul className="space-y-3 h-full justify-around flex flex-col">
                {col.views.map((v, i) => {
                  const slot = (v.matchup as any).bracket_slot ?? i + 1;
                  const winnerP1 = v.winnerId === v.matchup.player1_id;
                  const winnerP2 = v.winnerId === v.matchup.player2_id;
                  const p1Played = col.playedIds.has(v.matchup.player1_id);
                  const p2Played = col.playedIds.has(v.matchup.player2_id);
                  const showP1Name = !hideUnplayed || p1Played;
                  const showP2Name = !hideUnplayed || p2Played;
                  return (
                    <li
                      key={v.matchup.id}
                      className="rounded-md border bg-background overflow-hidden text-sm"
                    >
                      <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted/40 border-b">
                        Mesa {slot}
                      </div>
                      <div
                        className={[
                          "px-3 py-1.5 border-b flex items-center justify-between gap-2",
                          winnerP1 ? "font-semibold bg-green-500/5" : "",
                          v.winnerId && !winnerP1 ? "text-muted-foreground line-through decoration-1" : "",
                        ].join(" ")}
                      >
                        <span className="truncate">{showP1Name ? displayName(v.p1) : "—"}</span>
                        {winnerP1 && <span aria-label="Vencedor" title="Vencedor">✓</span>}
                      </div>
                      <div
                        className={[
                          "px-3 py-1.5 flex items-center justify-between gap-2",
                          winnerP2 ? "font-semibold bg-green-500/5" : "",
                          v.winnerId && !winnerP2 ? "text-muted-foreground line-through decoration-1" : "",
                        ].join(" ")}
                      >
                        <span className="truncate">{showP2Name ? displayName(v.p2) : "—"}</span>
                        {winnerP2 && <span aria-label="Vencedor" title="Vencedor">✓</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
