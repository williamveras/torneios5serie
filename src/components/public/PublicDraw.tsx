import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shuffle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { ViewMode } from "./ViewModeToggle";
import { buildMesaMap, pairKey, isGroupPhase } from "@/lib/phase";

type Matchup = Tables<"matchups">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  is_team?: boolean | null;
}

interface ScheduledDrawLite {
  id: string;
  fase: string;
  scheduled_at: string;
  status: string;
}

type TeamMembersMap = Record<string, { nome: string; nick: string | null }[]>;

interface Props {
  matchups: Matchup[];
  players: PlayerLite[];
  fase: string;
  scheduledDraws?: ScheduledDrawLite[];
  viewMode?: ViewMode;
  teamMembers?: TeamMembersMap;
}

import { getPlayerDisplayName } from "@/lib/playerDisplay";
const displayName = (p?: PlayerLite) => getPlayerDisplayName(p, "Jogador desconhecido");

const formatGroupLabel = (grupo: string) => {
  if (/^\d+$/.test(grupo)) return `Grupo ${grupo}`;
  return grupo;
};

const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

export default function PublicDraw({ matchups, players, fase, scheduledDraws = [], viewMode = "list" }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const faseMatchups = useMemo(
    () => matchups.filter(m => (m.fase || "Fase de Grupos") === fase),
    [matchups, fase],
  );

  const mesaMap = useMemo(() => buildMesaMap(matchups as any, fase), [matchups, fase]);
  const group = isGroupPhase(fase);

  // Group by grupo, then by rodada
  const groups = useMemo(() => {
    const byGroup = new Map<string, Matchup[]>();
    for (const mu of faseMatchups) {
      const arr = byGroup.get(mu.grupo) || [];
      arr.push(mu);
      byGroup.set(mu.grupo, arr);
    }
    const sortedGroupKeys = Array.from(byGroup.keys()).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    return sortedGroupKeys.map(grupo => {
      const items = (byGroup.get(grupo) || []).slice().sort((a, b) => {
        const ra = a.rodada ?? 9999;
        const rb = b.rodada ?? 9999;
        return ra - rb;
      });
      return { grupo, items };
    });
  }, [faseMatchups]);

  if (faseMatchups.length === 0) {
    const pending = scheduledDraws
      .filter((s) => s.fase === fase && s.status === "pending")
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
    if (pending) {
      const dt = new Date(pending.scheduled_at);
      return (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Shuffle className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
            <p className="text-lg font-semibold">Sorteio agendado</p>
            <p className="text-muted-foreground">
              O sorteio da <strong>{fase}</strong> será realizado automaticamente pelo sistema em:
            </p>
            <p className="text-xl font-semibold">
              {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              {" às "}
              {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground pt-2">
              Volte nesta página após o horário para ver os confrontos sorteados.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Shuffle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>O sorteio para esta fase ainda não foi realizado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Confrontos sorteados automaticamente pelo sistema para a <strong>{fase}</strong>. Esta visualização garante a transparência do sorteio.
      </p>

      {groups.map(({ grupo, items }) => (
        <section key={grupo} className="space-y-3">
          <h2 className="text-lg font-semibold">{formatGroupLabel(grupo)}</h2>

          {viewMode === "table" ? (
            <Card>
              <CardContent className="pt-4">
                <div className="rounded-md border overflow-x-auto">
                  <Table className="min-w-max">
                    <TableHeader>
                      <TableRow>
                      <TableHead className="whitespace-nowrap">{group ? "Grupo" : "Mesa"}</TableHead>
                      <TableHead className="whitespace-nowrap">Confronto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(mu => (
                        <TableRow key={mu.id}>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {group ? mu.grupo : (mesaMap.get(pairKey(mu.player1_id, mu.player2_id)) ?? "—")}
                          </TableCell>
                          <TableCell className={`font-medium ${noWrapText}`}>
                            {displayName(playerMap.get(mu.player1_id))} x {displayName(playerMap.get(mu.player2_id))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-4 space-y-2">
                {items.map(mu => (
                  <div key={mu.id} className="rounded-md border bg-muted/30 p-3 min-[360px]:p-4 min-w-0 overflow-hidden">
                    {!group && (
                      <div className={`text-sm text-muted-foreground ${scrollLine}`}>
                        <span className="public-line-content">
                          {keepTogether(`Mesa ${mesaMap.get(pairKey(mu.player1_id, mu.player2_id)) ?? "—"}`)}
                        </span>
                      </div>
                    )}
                    <h3 className={`text-base sm:text-lg font-semibold ${scrollLine}`}>
                      <span className="public-line-content">
                        <span>{keepTogether(displayName(playerMap.get(mu.player1_id)))}</span>{" "}
                        <span className="text-muted-foreground font-normal">x</span>{" "}
                        <span>{keepTogether(displayName(playerMap.get(mu.player2_id)))}</span>
                      </span>
                    </h3>
                  </div>
                ))}
              </CardContent>

            </Card>
          )}
        </section>
      ))}
    </div>
  );
}
