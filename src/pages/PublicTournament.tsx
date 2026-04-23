import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import PublicSchedule from "@/components/public/PublicSchedule";
import PublicResults from "@/components/public/PublicResults";
import PublicStandings from "@/components/public/PublicStandings";

type Tournament = Tables<"tournaments">;
type MatchResult = Tables<"match_results">;
type Schedule = Tables<"match_schedule">;
type PhaseStatus = Tables<"phase_status">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

export default function PublicTournament() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("players_public" as any).select("id, nome_completo, nick_playroom").eq("tournament_id", tournamentId),
      supabase.from("match_results").select("*").eq("tournament_id", tournamentId),
      supabase.from("match_schedule").select("*").eq("tournament_id", tournamentId),
      supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
    ]).then(([t, p, r, s, ps]) => {
      if (cancelled) return;
      if (!t.data) { setNotFound(true); setLoading(false); return; }
      setTournament(t.data);
      setPlayers(((p.data as unknown) as PlayerLite[]) || []);
      setResults(r.data || []);
      setSchedules(s.data || []);
      setPhaseStatuses(ps.data || []);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h1 className="text-xl font-semibold mb-2">Torneio não encontrado</h1>
            <p className="text-muted-foreground text-sm">
              O link pode estar incorreto ou o torneio foi removido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold leading-tight">{tournament.nome}</h1>
            <p className="text-xs text-muted-foreground">Acompanhamento público</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="schedule">
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="standings">Classificação</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule">
            <PublicSchedule schedules={schedules} players={players} />
          </TabsContent>
          <TabsContent value="results">
            <PublicResults results={results} players={players} phaseStatuses={phaseStatuses} />
          </TabsContent>
          <TabsContent value="standings">
            <PublicStandings results={results} players={players} phaseStatuses={phaseStatuses} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
