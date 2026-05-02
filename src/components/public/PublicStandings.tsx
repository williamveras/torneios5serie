import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { FASES } from "@/lib/constants";
import { computeStandings } from "@/lib/standings";
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
}

export default function PublicStandings({ results, players, phaseStatuses }: Props) {
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");

  const isFaseDeGrupos = selectedFase === "Fase de Grupos";

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

  const groups = useMemo(() => [...new Set(filteredByFase.map(r => r.grupo))].sort(), [filteredByFase]);

  const filtered = useMemo(() => {
    if (!isFaseDeGrupos || selectedGroup === "__all__") return filteredByFase;
    return filteredByFase.filter(r => r.grupo === selectedGroup);
  }, [filteredByFase, selectedGroup, isFaseDeGrupos]);

  const standings = useMemo(
    () => computeStandings(filtered, getPlayerName, getPlayerNick),
    [filtered, players],
  );

  const phaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isInProgress = phaseStatus === "em_andamento" && standings.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label htmlFor="public-fase">Fase</Label>
          <Select value={selectedFase} onValueChange={v => { setSelectedFase(v); setSelectedGroup("__all__"); }}>
            <SelectTrigger id="public-fase" className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(availableFases.length > 0 ? availableFases : FASES).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isFaseDeGrupos && groups.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="public-grupo">Grupo</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger id="public-grupo" className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                {groups.map(g => <SelectItem key={g} value={g}>Grupo {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {standings.length > 0 && (
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

      {standings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <ol
          className="space-y-2"
          aria-label={`Classificação — ${selectedFase}${isFaseDeGrupos && selectedGroup !== "__all__" ? `, grupo ${selectedGroup}` : ""}`}
        >
          {standings.map(s => {
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
                    {" "}
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
      )}
    </div>
  );
}
