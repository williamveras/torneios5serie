import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Download, ListChecks, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";
import RegistrosViewer from "./RegistrosViewer";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;
type Profile = Tables<"profiles">;

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
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchAllMatchResults(tournamentId).then(data => ({ data })),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("profiles").select("*"),
    ]).then(([{ data: rs }, { data: ps }, { data: prs }]) => {
      setResults(rs || []);
      setPlayers(Object.fromEntries((ps || []).map(p => [p.id, p])));
      setProfiles(Object.fromEntries((prs || []).map(p => [p.user_id, p])));
      setLoading(false);
    });
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
    return FASES.filter(f => map.has(f)).map(f => ({ fase: f, items: map.get(f)! }));
  }, [results]);

  const playerName = (id: string) => {
    const p = players[id];
    if (!p) return "Jogador desconhecido";
    return p.nick_playroom || p.nome_completo;
  };

  const registeredByName = (uid: string | null) =>
    !uid ? "Não informado" : profiles[uid]?.nome || "Usuário desconhecido";

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

    // Resumo
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

    // Uma aba por rodada, ordenada por grupo
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
