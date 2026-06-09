import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Download, ListChecks, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import { getActivePublicPhase } from "@/lib/phase";
import type { Tables } from "@/integrations/supabase/types";
import RegistrosViewer from "./RegistrosViewer";
import PublicResults from "@/components/public/PublicResults";
import ViewModeToggle, { type ViewMode } from "@/components/public/ViewModeToggle";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;
type Profile = Tables<"profiles">;
type Matchup = Tables<"matchups">;
type PhaseStatus = Tables<"phase_status">;

interface Props { tournamentId: string; }

const CONFRONTO_WINDOW_MS = 5 * 60 * 1000;

interface Confronto {
  fase: string;
  grupo: string;
  rodada: number;
  registered_by: string | null;
  results: MatchResult[];
}

export default function StatsTab({ tournamentId }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersMap, setPlayersMap] = useState<Record<string, Player>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAllMatchResults(tournamentId).then(data => ({ data })),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("profiles").select("*"),
      supabase.from("matchups").select("*").eq("tournament_id", tournamentId),
      supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
    ]).then(([{ data: rs }, { data: ps }, { data: prs }, { data: mu }, { data: phs }]) => {
      setResults(rs || []);
      setPlayers(ps || []);
      setPlayersMap(Object.fromEntries((ps || []).map(p => [p.id, p])));
      setProfiles(prs || []);
      setMatchups(mu || []);
      setPhaseStatuses(phs || []);
      setLoading(false);
    });
  }, [tournamentId]);

  const totalGames = Math.floor(results.length / 2);

  const playerName = (id: string) => {
    const p = playersMap[id];
    if (!p) return "Jogador desconhecido";
    return p.nick_playroom || p.nome_completo;
  };

  const registeredByName = (uid: string | null) => {
    if (!uid) return "Não informado";
    return profiles.find(p => p.user_id === uid)?.nome || "Usuário desconhecido";
  };

  const playersLite = useMemo(
    () => players.map(p => ({ id: p.id, nome_completo: p.nome_completo, nick_playroom: p.nick_playroom })),
    [players],
  );

  const moderatorsLite = useMemo(
    () => profiles.map(p => ({ user_id: p.user_id, nome: p.nome })),
    [profiles],
  );

  const byFase = useMemo(() => {
    const map = new Map<string, MatchResult[]>();
    for (const r of results) {
      const fase = r.fase || "Fase de Grupos";
      const arr = map.get(fase) || [];
      arr.push(r);
      map.set(fase, arr);
    }
    return FASES.filter(f => map.has(f)).map(f => ({ fase: f, items: map.get(f)! }));
  }, [results]);

  const activeFase = useMemo(() => getActivePublicPhase(phaseStatuses), [phaseStatuses]);
  const activeFaseGames = useMemo(() => {
    const faseData = byFase.find(b => b.fase === activeFase);
    return faseData ? Math.floor(faseData.items.length / 2) : 0;
  }, [byFase, activeFase]);

  const buildConfrontos = (rs: MatchResult[]): Confronto[] => {
    const buckets = new Map<string, MatchResult[]>();
    for (const r of rs) {
      const k = `${r.fase}||${r.grupo}||${r.rodada}||${r.registered_by ?? "null"}`;
      const arr = buckets.get(k) || [];
      arr.push(r);
      buckets.set(k, arr);
    }
    const out: Confronto[] = [];
    for (const arr of buckets.values()) {
      const used = new Set<string>();
      const chrono = [...arr].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      for (let i = 0; i < chrono.length; i++) {
        const a = chrono[i];
        if (used.has(a.id)) continue;
        let pair: MatchResult | null = null;
        for (let j = i + 1; j < chrono.length; j++) {
          const b = chrono[j];
          if (used.has(b.id)) continue;
          if (b.player_id === a.player_id) continue;
          const dt = Math.abs(+new Date(b.created_at) - +new Date(a.created_at));
          if (dt <= CONFRONTO_WINDOW_MS) { pair = b; break; }
          break;
        }
        const items = pair ? [a, pair] : [a];
        items.forEach(it => used.add(it.id));
        out.push({
          fase: a.fase,
          grupo: a.grupo,
          rodada: a.rodada,
          registered_by: a.registered_by,
          results: items,
        });
      }
    }
    return out;
  };

  const exportToXlsx = () => {
    if (results.length === 0) {
      toast.error("Nenhum registro para exportar");
      return;
    }
    const confrontos = buildConfrontos(results);
    const wb = XLSX.utils.book_new();

    const resumoRows: Record<string, unknown>[] = [];
    for (const { fase, items } of byFase) {
      const rounds = [...new Set(items.map(r => r.rodada))].sort((a, b) => a - b);
      for (const round of rounds) {
        const roundLines = items.filter(r => r.rodada === round);
        const groups = [...new Set(roundLines.map(r => r.grupo))].sort();
        resumoRows.push({
          "Fase": fase,
          "Rodada": round,
          "Grupos com registros": groups.length,
          "Jogos": Math.floor(roundLines.length / 2),
          "Registros": roundLines.length,
        });
      }
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), "Resumo");

    const rounds = [...new Set(confrontos.map(c => c.rodada))].sort((a, b) => a - b);
    for (const round of rounds) {
      const roundConfrontos = confrontos
        .filter(c => c.rodada === round)
        .sort((a, b) => {
          if (a.fase !== b.fase) return a.fase.localeCompare(b.fase);
          return a.grupo.localeCompare(b.grupo, undefined, { numeric: true });
        });
      const rows = roundConfrontos.map(c => {
        const [r1, r2] = c.results;
        return {
          "Fase": c.fase,
          "Grupo": c.fase === "Fase de Grupos" ? c.grupo : "-",
          "Jogador 1": playerName(r1.player_id),
          "Pts Vitória 1": r1.pontos_jogo,
          "Pts Mesa 1": r1.pontos_mesa,
          "Penalidades 1": r1.penalidades,
          "Jogador 2": r2 ? playerName(r2.player_id) : "(sem par)",
          "Pts Vitória 2": r2 ? r2.pontos_jogo : "",
          "Pts Mesa 2": r2 ? r2.pontos_mesa : "",
          "Penalidades 2": r2 ? r2.penalidades : "",
          "Registrado por": registeredByName(c.registered_by),
        };
      });
      const sheetName = `Rodada ${round}`.slice(0, 31);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName);
    }

    XLSX.writeFile(wb, `estatisticas_torneio.xlsx`);
    toast.success("Exportação concluída");
  };

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

      <div className="flex justify-end">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      <PublicResults
        results={results}
        players={playersLite}
        matchups={matchups}
        phaseStatuses={phaseStatuses}
        moderators={moderatorsLite}
        viewMode={viewMode}
      />

      <div className="flex justify-center gap-2 pt-2 flex-wrap">
        <Button variant="outline" onClick={() => setViewerOpen(true)}>
          <ListChecks className="h-4 w-4 mr-2" /> Visualizar registros
        </Button>
        <Button variant="outline" onClick={exportToXlsx}>
          <Download className="h-4 w-4 mr-2" /> Exportar estatísticas
        </Button>
      </div>

      <RegistrosViewer tournamentId={tournamentId} open={viewerOpen} onOpenChange={setViewerOpen} />
    </div>
  );
}
