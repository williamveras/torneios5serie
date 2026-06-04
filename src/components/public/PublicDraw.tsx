import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shuffle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import type { ViewMode } from "./ViewModeToggle";

type Matchup = Tables<"matchups">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface ScheduledDrawLite {
  id: string;
  fase: string;
  scheduled_at: string;
  status: string;
}

interface Props {
  matchups: Matchup[];
  players: PlayerLite[];
  fase: string;
  scheduledDraws?: ScheduledDrawLite[];
  viewMode?: ViewMode;
}

const displayName = (p?: PlayerLite) => {
  if (!p) return "Jogador desconhecido";
  const nick = p.nick_playroom?.trim();
  return nick || p.nome_completo;
};

const formatGroupLabel = (grupo: string) => {
  if (/^\d+$/.test(grupo)) return `Grupo ${grupo}`;
  return grupo;
};

const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

export default function PublicDraw({ matchups, players, fase, viewMode = "list" }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const faseMatchups = useMemo(
    () => matchups.filter(m => (m.fase || "Fase de Grupos") === fase),
    [matchups, fase],
  );

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
                        <TableHead className="whitespace-nowrap">Rodada</TableHead>
                        <TableHead className="whitespace-nowrap">Confronto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map(mu => (
                        <TableRow key={mu.id}>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            {mu.rodada ?? "—"}
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
                    <div className={`text-sm text-muted-foreground ${scrollLine}`}>
                      <span className="public-line-content">
                        {keepTogether(mu.rodada != null ? `Rodada ${mu.rodada}` : "Rodada a definir")}
                      </span>
                    </div>
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
