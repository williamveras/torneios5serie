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
import { getActivePublicPhase, buildMainFases } from "@/lib/phase";
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
  grupo?: string | null;
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
  const [teamMembers, setTeamMembers] = useState<Record<string, { nome: string; nick: string | null }[]>>({});
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
      const playersData = ((p.data as unknown) as PlayerLite[]) || [];
      setPlayers(playersData);
      // Carrega membros das equipes (duplas) para exibir nomes nos rótulos.
      const teamIds = playersData.filter((pl) => pl.is_team).map((pl) => pl.id);
      if (teamIds.length > 0) {
        const { data: tmAll } = await (supabase as any).rpc("get_team_members_public", { _tournament_id: tournamentId });
        const tm = ((tmAll as any[]) || []).filter((r) => teamIds.includes(r.team_id));
        const map: Record<string, { nome: string; nick: string | null }[]> = {};
        ((tm as any[]) || [])
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .forEach((row) => {
            const arr = map[row.team_id] || (map[row.team_id] = []);
            arr.push({ nome: row.member_nome, nick: row.member_nick });
          });
        setTeamMembers(map);
      } else {
        setTeamMembers({});
      }
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
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_draws", filter: `tournament_id=eq.${tournamentId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` }, refresh)
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

  // Projeção do caminho principal de fases para este torneio (Quartas/Semi/Final
  // calculadas a partir do nº de classificados). Usado para rotular abas e
  // detectar a fase ativa em torneios menores.
  const numGroups = new Set(
    players.map((p) => p.grupo).filter((g) => g != null && String(g).trim() !== ""),
  ).size;
  const td: any = tournament;
  const repTotal = td.repescagem_enabled === false ? 0 : (td.repescagem_total ?? 0);
  const eliminationOnly = td.elimination_only === true;
  const mainFases = buildMainFases({
    directPerGroup: td.direct_per_group ?? null,
    repescagemTotal: repTotal,
    numGroups,
    eliminationOnly,
    totalParticipants: td.max_participants ?? players.length,
    repescagemMode: (td.repescagem_mode as any) ?? "ranking",
    repescagemPlayoffSize: td.repescagem_playoff_size ?? null,
  });
  const mainList = mainFases && mainFases.length > 0
    ? mainFases
    : FASES.filter((f) => !isSideFase(f) && f !== "Repescagem");

  // Latest concluded fase (by main path) drives the tab label.
  let latestConcluded: string | null = null;
  for (let i = mainList.length - 1; i >= 0; i--) {
    const f = mainList[i];
    if (phaseStatuses.find(p => p.fase === f)?.status === "concluida") { latestConcluded = f; break; }
  }
  const nextFaseLabel = latestConcluded ? nextPhaseName(latestConcluded, mainFases) : "";
  const nextFaseDisplay = nextFaseLabel === "Final" ? "grande final e disputa de terceiro" : nextFaseLabel;
  const standingsTabLabel = latestConcluded && nextFaseLabel ? `Classificados (${nextFaseDisplay})` : "Classificação";

  // Sorteio tab: mostra a fase pública ativa quando houver confrontos sorteados
  // ou um sorteio agendado pendente para ela.
  const drawFase = getActivePublicPhase(phaseStatuses, mainFases);
  const hasMatchupsForDrawFase = matchups.some((m) => (m.fase || "Fase de Grupos") === drawFase && (m as any).published === true);
  const hasPendingDraw = scheduledDraws.some(
    (s) => s.fase === drawFase && s.status === "pending",
  );
  const showDrawTab = hasMatchupsForDrawFase || hasPendingDraw;
  const drawTabLabel = `Sorteio dos confrontos - ${drawFase}`;

  // Disposição dos grupos: só aparece em torneios COM Fase de Grupos
  const hasGroupsDefined = players.some((p) => p.grupo);
  const hasPendingGroupDraw = scheduledDraws.some(
    (s) => s.status === "pending" && ((s as any).kind === "grupos" || s.fase === "Fase de Grupos"),
  );
  const showGroupsTab = !eliminationOnly && (hasGroupsDefined || hasPendingGroupDraw);


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
          const tabCount = 4 + (showDrawTab ? 1 : 0) + (showGroupsTab ? 1 : 0);
          const gridCls = tabCount >= 6
            ? "grid-cols-2 sm:grid-cols-6"
            : tabCount === 5
            ? "grid-cols-2 sm:grid-cols-5"
            : "grid-cols-4";
          return (
            <Tabs defaultValue="results" activationMode="manual">
              <TabsList className={`mb-4 grid w-full h-auto gap-1 ${gridCls}`}>
                <TabsTrigger value="results" className="text-xs sm:text-sm py-2">Resultados</TabsTrigger>
                <TabsTrigger value="standings" className="text-xs sm:text-sm py-2">{standingsTabLabel}</TabsTrigger>
                <TabsTrigger value="schedule" className="text-xs sm:text-sm py-2">Confrontos</TabsTrigger>
                {showGroupsTab && (
                  <TabsTrigger value="groups" className="text-xs sm:text-sm py-2">Disposição dos grupos</TabsTrigger>
                )}
                {showDrawTab && (
                  <TabsTrigger value="draw" className="text-xs sm:text-sm py-2">{drawTabLabel}</TabsTrigger>
                )}
                <TabsTrigger value="regulamento" className="text-xs sm:text-sm py-2">Regulamento</TabsTrigger>
              </TabsList>

              <TabsContent value="results">
                <div className="flex justify-end mb-3">
                  <ViewModeToggle value={resultsView} onChange={setResultsView} />
                </div>
                <PublicResults results={results} players={players} matchups={matchups} phaseStatuses={phaseStatuses} moderators={moderators} viewMode={resultsView} teamMembers={teamMembers} />
              </TabsContent>
              <TabsContent value="standings">
                <div className="flex justify-end mb-3">
                  <ViewModeToggle value={standingsView} onChange={setStandingsView} />
                </div>
                <PublicStandings
                  results={results}
                  players={players}
                  teamMembers={teamMembers}
                  matchups={matchups}
                  phaseStatuses={phaseStatuses}
                  viewMode={standingsView}
                  lowerWins={(tournament as any)?.lower_score_wins === true}
                  qualifierOpts={(() => {
                    const td = tournament as any;
                    const opts: { directPerGroup?: number; repescagemTotal?: number; mode?: "ranking" | "playoff"; playoffSize?: number } = {};
                    if (td.direct_per_group != null) opts.directPerGroup = td.direct_per_group;
                    if (td.repescagem_enabled === false) opts.repescagemTotal = 0;
                    else if (td.repescagem_total != null) opts.repescagemTotal = td.repescagem_total;
                    opts.mode = (td.repescagem_mode as any) ?? "ranking";
                    if (td.repescagem_playoff_size != null) opts.playoffSize = td.repescagem_playoff_size;
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
              {showGroupsTab && (
                <TabsContent value="groups">
                  <PublicGroups players={players} teamMembers={teamMembers} scheduledDraws={scheduledDraws as any} />
                </TabsContent>
              )}
              {showDrawTab && drawFase && (
                <TabsContent value="draw">
                  <div className="flex justify-end mb-3">
                    <ViewModeToggle value={drawView} onChange={setDrawView} />
                  </div>
                  <PublicDraw matchups={matchups} players={players} fase={drawFase} scheduledDraws={scheduledDraws} viewMode={drawView} teamMembers={teamMembers} />
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
