import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, ListChecks, Loader2 } from "lucide-react";
import { FASES } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";
import RegistrosViewer from "./RegistrosViewer";

type MatchResult = Tables<"match_results">;

interface Props { tournamentId: string; }

// Cada partida gera 2 linhas em match_results (uma por jogador).
// Total de partidas = linhas / 2.
export default function StatsTab({ tournamentId }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    supabase.from("match_results").select("*").eq("tournament_id", tournamentId)
      .then(({ data }) => { setResults(data || []); setLoading(false); });
  }, [tournamentId]);

  const totalGames = Math.floor(results.length / 2);

  const byFase = useMemo(() => {
    const map = new Map<string, MatchResult[]>();
    for (const r of results) {
      const fase = r.fase || "Fase de Grupos";
      const arr = map.get(fase) || [];
      arr.push(r);
      map.set(fase, arr);
    }
    // ordenar pela ordem oficial
    return FASES.filter(f => map.has(f)).map(f => ({ fase: f, items: map.get(f)! }));
  }, [results]);

  if (loading) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 mx-auto animate-spin opacity-50" />
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Total de jogos registrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold tabular-nums">{totalGames}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Cada jogo corresponde a 2 registros (um por jogador).
          </p>
        </CardContent>
      </Card>

      {byFase.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nenhum jogo registrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        byFase.map(({ fase, items }) => {
          const rounds = [...new Set(items.map(r => r.rodada))].sort((a, b) => a - b);
          const faseTotal = Math.floor(items.length / 2);
          return (
            <Card key={fase}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>{fase}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    {faseTotal} {faseTotal === 1 ? "jogo" : "jogos"}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {rounds.map(round => {
                    const roundLines = items.filter(r => r.rodada === round);
                    const roundGames = Math.floor(roundLines.length / 2);
                    const groups = [...new Set(roundLines.map(r => r.grupo))].sort();
                    return (
                      <li key={round} className="flex items-center justify-between p-2 rounded-md border bg-muted/30">
                        <div>
                          <div className="font-medium text-sm">Rodada {round}</div>
                          {fase === "Fase de Grupos" && (
                            <div className="text-xs text-muted-foreground">
                              {groups.length} {groups.length === 1 ? "grupo" : "grupos"} com registros
                            </div>
                          )}
                        </div>
                        <div className="text-lg font-semibold tabular-nums">
                          {roundGames} <span className="text-xs font-normal text-muted-foreground">{roundGames === 1 ? "jogo" : "jogos"}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          );
        })
      )}

      <div className="flex justify-center pt-2">
        <Button variant="outline" onClick={() => setViewerOpen(true)}>
          <ListChecks className="h-4 w-4 mr-2" /> Visualizar registros
        </Button>
      </div>

      <RegistrosViewer tournamentId={tournamentId} open={viewerOpen} onOpenChange={setViewerOpen} />
    </div>
  );
}
