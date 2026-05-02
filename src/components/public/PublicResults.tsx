import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { FASES } from "@/lib/constants";
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

export default function PublicResults({ results, players, phaseStatuses }: Props) {
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const fullName = (id: string) => {
    const p = playerMap.get(id);
    if (!p) return "Jogador desconhecido";
    const nick = p.nick_playroom?.trim();
    return nick || p.nome_completo;
  };

  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => r.fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const filtered = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === selectedFase),
    [results, selectedFase],
  );

  const isFaseDeGrupos = selectedFase === "Fase de Grupos";
  const rounds = useMemo(() => [...new Set(filtered.map(r => r.rodada))].sort((a, b) => a - b), [filtered]);

  const phaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isInProgress = phaseStatus === "em_andamento" && filtered.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label htmlFor="public-results-fase">Fase</Label>
          <Select value={selectedFase} onValueChange={setSelectedFase}>
            <SelectTrigger id="public-results-fase" className="w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(availableFases.length > 0 ? availableFases : FASES).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length > 0 && (
        isInProgress ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10" role="status">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <strong>Fase em andamento</strong> — os resultados abaixo são parciais e podem mudar até o encerramento da fase.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500/50 bg-green-500/10" role="status">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <strong>Fase encerrada</strong> — resultados oficiais.
            </AlertDescription>
          </Alert>
        )
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rounds.map(round => {
            const roundResults = filtered.filter(r => r.rodada === round);
            return (
              <section key={round} aria-labelledby={`rodada-${round}`}>
                <Card>
                  <CardContent className="pt-4">
                    <h3 id={`rodada-${round}`} className="font-semibold mb-3 text-lg">
                      Rodada {round}
                    </h3>
                    <ul className="space-y-3">
                      {roundResults.map(r => {
                        const penalidade = r.penalidades !== "Sem penalidades";
                        const playerName = fullName(r.player_id);
                        return (
                          <li
                            key={r.id}
                            className="rounded-md border bg-muted/30 p-3"
                          >
                            <p className="font-medium" aria-label={`Jogador: ${playerName}`}>
                              <span aria-hidden="true">{playerName}</span>
                            </p>
                            {isFaseDeGrupos && (
                              <p className="text-sm text-muted-foreground">
                                Grupo {r.grupo}
                              </p>
                            )}
                            <p className="text-sm mt-1">
                              <span>Pontos de vitória: <strong>{r.pontos_jogo}</strong>.</span>
                              {" "}
                              <span>Pontos de mesa: <strong>{r.pontos_mesa}</strong>.</span>
                            </p>
                            <p className={`text-sm ${penalidade ? "text-destructive" : "text-muted-foreground"}`}>
                              Penalidades: {r.penalidades}.
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
