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

interface Confronto {
  key: string;
  created_at: string;
  fase: string;
  grupo: string;
  rodada: number;
  players: MatchResult[];
}

const formatDateTime = (iso: string) => {
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const mi = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} às ${hh}:${mi}`;
  } catch {
    return iso;
  }
};

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

  const confrontos = useMemo<Confronto[]>(() => {
    const map = new Map<string, Confronto>();
    for (const r of filtered) {
      const fase = r.fase || "Fase de Grupos";
      const key = `${r.created_at}|${fase}|${r.grupo}|${r.rodada}`;
      const existing = map.get(key);
      if (existing) {
        existing.players.push(r);
      } else {
        map.set(key, {
          key,
          created_at: r.created_at,
          fase,
          grupo: r.grupo,
          rodada: r.rodada,
          players: [r],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }, [filtered]);

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

      {confrontos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <ol className="space-y-3 list-none p-0" aria-label={`Confrontos registrados — ${selectedFase}`}>
          {confrontos.map(c => {
            const incompleto = c.players.length < 2;
            const ariaLabel =
              `Confronto${isFaseDeGrupos ? `, Grupo ${c.grupo}` : ""}, Rodada ${c.rodada}, postado em ${formatDateTime(c.created_at)}`;
            return (
              <li key={c.key}>
                <article aria-label={ariaLabel}>
                  <Card>
                    <CardContent className="pt-4">
                      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground mb-3">
                        <span className="font-medium text-foreground">
                          {formatDateTime(c.created_at)}
                        </span>
                        {isFaseDeGrupos && (
                          <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground text-xs">
                            Grupo {c.grupo}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded bg-muted text-xs">
                          Rodada {c.rodada}
                        </span>
                        {incompleto && (
                          <span className="text-xs text-yellow-600">Registro avulso</span>
                        )}
                      </header>
                      {!incompleto && (
                        <p className="text-base font-semibold mb-3" aria-hidden="true">
                          {fullName(c.players[0].player_id)} <span className="text-muted-foreground font-normal">x</span> {fullName(c.players[1].player_id)}
                        </p>
                      )}
                      <ul className="space-y-2">
                        {c.players.map(r => {
                          const penalidade = r.penalidades !== "Sem penalidades";
                          return (
                            <li
                              key={r.id}
                              className="rounded-md border bg-muted/30 p-3"
                            >
                              <p className="font-medium">
                                <span className="sr-only">Jogador:&nbsp;</span>
                                {fullName(r.player_id)}
                              </p>
                              <p className="text-sm mt-1">
                                <strong>{r.pontos_jogo}</strong> ponto{r.pontos_jogo === 1 ? "" : "s"} de vitória, <strong>{r.pontos_mesa}</strong> ponto{r.pontos_mesa === 1 ? "" : "s"} de mesa neste confronto.
                              </p>
                              {penalidade && (
                                <p className="text-sm text-destructive">
                                  Penalidades: {r.penalidades}.
                                </p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </CardContent>
                  </Card>
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
