import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { FASES } from "@/lib/constants";
import { computeStandings } from "@/lib/standings";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type PhaseStatus = Tables<"phase_status">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface Props {
  results: MatchResult[];
  players: PlayerLite[];
  phaseStatuses: PhaseStatus[];
  viewMode?: ViewMode;
}

const naturalGroupSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
};

const hasGroup = (g: string | null | undefined) => !!g && g.trim() !== "";

export default function PublicStandings({ results, players, phaseStatuses, viewMode = "list" }: Props) {
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const getPlayerName = (id: string) => playerMap.get(id)?.nome_completo || "Jogador desconhecido";
  const getPlayerNick = (id: string) => playerMap.get(id)?.nick_playroom || "";

  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => r.fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const filteredByFase = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === selectedFase),
    [results, selectedFase],
  );

  const hasAnyGroup = useMemo(() => filteredByFase.some(r => hasGroup(r.grupo)), [filteredByFase]);

  const groups = useMemo(
    () => [...new Set(filteredByFase.filter(r => hasGroup(r.grupo)).map(r => r.grupo))].sort(naturalGroupSort),
    [filteredByFase],
  );

  const sections = useMemo(() => {
    if (!hasAnyGroup) {
      return [{
        grupo: "",
        rows: computeStandings(filteredByFase, getPlayerName, getPlayerNick),
      }];
    }
    return groups.map(g => ({
      grupo: g,
      rows: computeStandings(
        filteredByFase.filter(r => r.grupo === g),
        getPlayerName,
        getPlayerNick,
      ),
    }));
  }, [filteredByFase, groups, hasAnyGroup, players]);

  const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);

  const phaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isInProgress = phaseStatus === "em_andamento" && totalRows > 0;

  return (
    <div className="space-y-4">
      {totalRows > 0 && (
        isInProgress ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10" role="status">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <strong>Fase em andamento</strong> — esta classificação é parcial e pode mudar até o encerramento da fase.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500/50 bg-green-500/10" role="status">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Fase encerrada</strong> — classificação oficial.
            </AlertDescription>
          </Alert>
        )
      )}

      {totalRows === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map(sec => (
            <section key={sec.grupo || "__no_group__"}>
              {hasAnyGroup && (
                <h3 className="font-semibold text-lg mb-2">
                  Grupo {sec.grupo}
                </h3>
              )}
              <ol
                className="space-y-2"
                aria-label={
                  hasAnyGroup
                    ? `Classificação do grupo ${sec.grupo}`
                    : `Classificação — ${selectedFase}`
                }
              >
                {sec.rows.map(s => {
                  const displayName = s.nick || s.playerName;
                  return (
                    <li
                      key={s.playerId}
                      className={`rounded-md border bg-background p-3 flex items-start gap-3 ${s.hasPenalty ? "bg-destructive/5" : ""}`}
                    >
                      <div
                        className="font-bold tabular-nums text-lg min-w-[2.5rem]"
                        aria-label={`Posição ${s.position}`}
                      >
                        {s.position}º
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{displayName}</p>
                        <p className="text-sm mt-0.5">
                          <span>Pontos de vitória: <strong>{s.pontosJogo}</strong>.</span>
                        </p>
                        <p className="text-sm">
                          <span>Pontos de mesa: <strong>{s.pontosMesa}</strong>.</span>
                        </p>
                        <p className={`text-sm ${s.hasPenalty ? "text-destructive" : "text-muted-foreground"}`}>
                          Penalidades: {s.penalidades}.
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
