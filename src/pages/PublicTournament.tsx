import { useEffect, useState } from "react";
import { getPlayerDisplayName } from "@/lib/playerDisplay";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import PublicSchedule from "@/components/public/PublicSchedule";
import PublicResults from "@/components/public/PublicResults";
import PublicStandings from "@/components/public/PublicStandings";
import PublicRegulamento from "@/components/public/PublicRegulamento";
import PublicDraw from "@/components/public/PublicDraw";
import PublicGroups from "@/components/public/PublicGroups";

import { FASES, isSideFase } from "@/lib/constants";
import { nextPhaseName } from "@/lib/qualifiers";
import { getActivePublicPhase } from "@/lib/phase";
import ViewModeToggle, { type ViewMode } from "@/components/public/ViewModeToggle";

type Tournament = Tables<"tournaments">;
type MatchResult = Tables<"match_results">;
type Schedule = Tables<"match_schedule">;
type PhaseStatus = Tables<"phase_status">;
type Matchup = Tables<"matchups">;
type ScheduledDraw = Tables<"scheduled_draws">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  is_team?: boolean | null;
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
  const [scheduledDraws, setScheduledDraws] = useState<ScheduledDraw[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [moderators, setModerators] = useState<ModeratorLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [resultsView, setResultsView] = useState<ViewMode>("list");
  const [standingsView, setStandingsView] = useState<ViewMode>("list");
  const [scheduleView, setScheduleView] = useState<ViewMode>("list");
  const [drawView, setDrawView] = useState<ViewMode>("list");

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;

    const loadData = async (showLoading = false) => {
      if (showLoading) setLoading(true);
      const [t, p, r, s, ps, m, mu, sd] = await Promise.all([
        supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
        (supabase as any).rpc("get_players_public", { _tournament_id: tournamentId }),
        fetchAllMatchResults(tournamentId).then(data => ({ data })),
        supabase.from("match_schedule").select("*").eq("tournament_id", tournamentId),
        supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
        (supabase as any).rpc("get_moderators_public", { _tournament_id: tournamentId }),
        supabase.from("matchups").select("*").eq("tournament_id", tournamentId),
        supabase.from("scheduled_draws").select("*").eq("tournament_id", tournamentId),
      ]);
      if (cancelled) return;
      if (!t.data) { setNotFound(true); setLoading(false); return; }
      setNotFound(false);
      setTournament(t.data);
      setPlayers(((p.data as unknown) as PlayerLite[]) || []);
      setResults(r.data || []);
      setSchedules(s.data || []);
      setPhaseStatuses(ps.data || []);
      setModerators(((m.data as unknown) as ModeratorLite[]) || []);
      setMatchups(mu.data || []);
      setScheduledDraws(sd.data || []);
      setLoading(false);
    };

    loadData(true);

    const refresh = () => loadData(false);
    const channel = supabase
      .channel(`public_tournament_${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_schedule", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "matchups", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "phase_status", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  useEffect(() => {
    const prev = document.title;
    if (tournament?.nome) document.title = `${tournament.nome} - Torneios Quinta Série`;
    return () => { document.title = prev; };
  }, [tournament?.nome]);

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

  // Latest concluded fase (by FASES order) drives the tab label.
  let latestConcluded: string | null = null;
  for (let i = FASES.length - 1; i >= 0; i--) {
    const f = FASES[i];
    if (isSideFase(f)) continue;
    if (phaseStatuses.find(p => p.fase === f)?.status === "concluida") { latestConcluded = f; break; }
  }
  const nextFaseLabel = latestConcluded ? nextPhaseName(latestConcluded) : "";
  const nextFaseDisplay = nextFaseLabel === "Final" ? "grande final e disputa de terceiro" : nextFaseLabel;
  const standingsTabLabel = latestConcluded && nextFaseLabel ? `Classificados (${nextFaseDisplay})` : "Classificação";

  // Sorteio tab: mostra a fase pública ativa quando houver confrontos sorteados
  // ou um sorteio agendado pendente para ela.
  const drawFase = getActivePublicPhase(phaseStatuses);
  const hasMatchupsForDrawFase = matchups.some((m) => (m.fase || "Fase de Grupos") === drawFase);
  const hasPendingDraw = scheduledDraws.some(
    (s) => s.fase === drawFase && s.status === "pending",
  );
  const showDrawTab = hasMatchupsForDrawFase || hasPendingDraw;
  const drawTabLabel = `Sorteio dos confrontos - ${drawFase}`;

  const campeaoId = (tournament as any).campeao_id as string | null | undefined;
  const campeao = campeaoId ? players.find(p => p.id === campeaoId) : null;

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
        {campeao && (
          <div className="bg-amber-500/10 border-t border-amber-500/30 py-2 px-4 text-center text-sm font-medium text-amber-900 dark:text-amber-200">
            🏆 Campeão: {getPlayerDisplayName(campeao as any)}
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-3 py-6 sm:px-4">
        {(() => {
          const tabCount = 4 + (showDrawTab ? 1 : 0);
          const gridCls = tabCount === 5
            ? "grid-cols-2 sm:grid-cols-5"
            : "grid-cols-4";
          return (
            <Tabs defaultValue="results" activationMode="manual">
              <TabsList className={`mb-4 grid w-full h-auto gap-1 ${gridCls}`}>
                <TabsTrigger value="results" className="text-xs sm:text-sm py-2">Resultados</TabsTrigger>
                <TabsTrigger value="standings" className="text-xs sm:text-sm py-2">{standingsTabLabel}</TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2">Confrontos</TabsTrigger>
                {showDrawTab && (
                  <TabsTrigger value="draw" className="text-xs sm:text-sm py-2">{drawTabLabel}</TabsTrigger>
                )}
                <TabsTrigger value="regulamento" className="text-xs sm:text-sm py-2">Regulamento</TabsTrigger>
              </TabsList>

              <TabsContent value="results">
                <div className="flex justify-end mb-3">
                  <ViewModeToggle value={resultsView} onChange={setResultsView} />
                </div>
                <PublicResults results={results} players={players} matchups={matchups} phaseStatuses={phaseStatuses} moderators={moderators} viewMode={resultsView} />
              </TabsContent>
              <TabsContent value="standings">
                <div className="flex justify-end mb-3">
                  <ViewModeToggle value={standingsView} onChange={setStandingsView} />
                </div>
                <PublicStandings
                  results={results}
                  players={players}
                  matchups={matchups}
                  phaseStatuses={phaseStatuses}
                  viewMode={standingsView}
                  lowerWins={(tournament as any)?.lower_score_wins === true}
                  qualifierOpts={(() => {
                    const td = tournament as any;
                    const opts: { directPerGroup?: number; repescagemTotal?: number } = {};
                    if (td.direct_per_group != null) opts.directPerGroup = td.direct_per_group;
                    if (td.repescagem_enabled === false) opts.repescagemTotal = 0;
                    else if (td.repescagem_total != null) opts.repescagemTotal = td.repescagem_total;
                    return opts;
                  })()}
                />
              </TabsContent>
              <TabsContent value="schedule">
                <div className="flex justify-end mb-3">
                  <ViewModeToggle value={scheduleView} onChange={setScheduleView} />
                </div>
                <PublicSchedule schedules={schedules} players={players} matchups={matchups} results={results} phaseStatuses={phaseStatuses} numeroRodadas={(tournament as any).numero_rodadas ?? null} viewMode={scheduleView} />
              </TabsContent>
              {showDrawTab && drawFase && (
                <TabsContent value="draw">
                  <div className="flex justify-end mb-3">
                    <ViewModeToggle value={drawView} onChange={setDrawView} />
                  </div>
                  <PublicDraw matchups={matchups} players={players} fase={drawFase} scheduledDraws={scheduledDraws} viewMode={drawView} />
                </TabsContent>
              )}
              <TabsContent value="regulamento">
                <PublicRegulamento regulamento={tournament.regulamento ?? null} />
              </TabsContent>
            </Tabs>
          );
        })()}
      </main>
    </div>
  );
}
