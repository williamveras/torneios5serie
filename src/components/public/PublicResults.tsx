import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

  const displayName = (id: string) => {
    const p = playerMap.get(id);
    return p?.nick_playroom?.trim() || p?.nome_completo || "Desconhecido";
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
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <strong>Fase em andamento</strong> — os resultados abaixo são parciais e podem mudar até o encerramento da fase.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500/50 bg-green-500/10">
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
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rounds.map(round => {
            const roundResults = filtered.filter(r => r.rodada === round);
            return (
              <Card key={round}>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3">Rodada {round}</h3>
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nick</TableHead>
                          {isFaseDeGrupos && <TableHead>Grupo</TableHead>}
                          <TableHead className="text-right">Pts Vitória</TableHead>
                          <TableHead className="text-right">Pts Mesa</TableHead>
                          <TableHead>Penalidades</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roundResults.map(r => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{displayName(r.player_id)}</TableCell>
                            {isFaseDeGrupos && <TableCell>{r.grupo}</TableCell>}
                            <TableCell className="text-right tabular-nums">{r.pontos_jogo}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.pontos_mesa}</TableCell>
                            <TableCell className={r.penalidades !== "Sem penalidades" ? "text-destructive" : "text-muted-foreground"}>
                              {r.penalidades}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
