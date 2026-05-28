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
import PublicRegulamento from "@/components/public/PublicRegulamento";
import ViewModeToggle, { type ViewMode } from "@/components/public/ViewModeToggle";

type Tournament = Tables<"tournaments">;
type MatchResult = Tables<"match_results">;
type Schedule = Tables<"match_schedule">;
type PhaseStatus = Tables<"phase_status">;
type Matchup = Tables<"matchups">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface ModeratorLite {
  user_id: string;
  nome: string;
}

export default function PublicTournament() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<PlayerLite[]>([]);
  const [results, setResults] = useState<MatchResult[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [moderators, setModerators] = useState<ModeratorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resultsView, setResultsView] = useState<ViewMode>("list");
  const [standingsView, setStandingsView] = useState<ViewMode>("list");
  const [scheduleView, setScheduleView] = useState<ViewMode>("list");

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    setLoading(true);

    Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      (supabase as any).rpc("get_players_public", { _tournament_id: tournamentId }),
      supabase.from("match_results").select("*").eq("tournament_id", tournamentId),
      supabase.from("match_schedule").select("*").eq("tournament_id", tournamentId),
      supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
      (supabase as any).rpc("get_moderators_public", { _tournament_id: tournamentId }),
      supabase.from("matchups").select("*").eq("tournament_id", tournamentId),
    ]).then(([t, p, r, s, ps, m, mu]) => {
      if (cancelled) return;
      if (!t.data) { setNotFound(true); setLoading(false); return; }
      setTournament(t.data);
      setPlayers(((p.data as unknown) as PlayerLite[]) || []);
      setResults(r.data || []);
      setSchedules(s.data || []);
      setPhaseStatuses(ps.data || []);
      setModerators(((m.data as unknown) as ModeratorLite[]) || []);
      setMatchups(mu.data || []);
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
    <div className="public-page min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <Trophy className="h-5 w-5 text-primary" />
          <div>
            <h1 className="font-semibold leading-tight">{tournament.nome}</h1>
            <p className="text-xs text-muted-foreground">Acompanhamento público</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 py-6 sm:px-4">
        <Tabs defaultValue="results" activationMode="manual">
          <TabsList className="mb-4 grid grid-cols-4 w-full h-auto gap-1">
            <TabsTrigger value="results" className="text-xs sm:text-sm py-2">Resultados</TabsTrigger>
            <TabsTrigger value="standings" className="text-xs sm:text-sm py-2">Classificação</TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2">Confrontos</TabsTrigger>
            <TabsTrigger value="regulamento" className="text-xs sm:text-sm py-2">Regulamento</TabsTrigger>
          </TabsList>

          <TabsContent value="results">
            <div className="flex justify-end mb-3">
              <ViewModeToggle value={resultsView} onChange={setResultsView} />
            </div>
            <PublicResults results={results} players={players} phaseStatuses={phaseStatuses} moderators={moderators} viewMode={resultsView} />
          </TabsContent>
          <TabsContent value="standings">
            <div className="flex justify-end mb-3">
              <ViewModeToggle value={standingsView} onChange={setStandingsView} />
            </div>
            <PublicStandings results={results} players={players} phaseStatuses={phaseStatuses} viewMode={standingsView} />
          </TabsContent>
          <TabsContent value="schedule">
            <div className="flex justify-end mb-3">
              <ViewModeToggle value={scheduleView} onChange={setScheduleView} />
            </div>
            <PublicSchedule schedules={schedules} players={players} matchups={matchups} results={results} numeroRodadas={(tournament as any).numero_rodadas ?? null} viewMode={scheduleView} />

          </TabsContent>
          <TabsContent value="regulamento">
            <PublicRegulamento regulamento={tournament.regulamento ?? null} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
