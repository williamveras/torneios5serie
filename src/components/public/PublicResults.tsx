import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { FASES } from "@/lib/constants";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type PhaseStatus = Tables<"phase_status">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface ModeratorLite {
  user_id: string;
  nome: string;
}

interface Props {
  results: MatchResult[];
  players: PlayerLite[];
  phaseStatuses: PhaseStatus[];
  moderators: ModeratorLite[];
  viewMode?: ViewMode;
}

interface Confronto {
  key: string;
  created_at: string;
  fase: string;
  grupo: string;
  rodada: number;
  registered_by: string | null;
  players: MatchResult[];
}

const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const TZ = "America/Sao_Paulo";

// Returns parts in Brasília timezone for a given Date
const brasiliaParts = (d: Date) => {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    // Use getDay via a normalized date string to derive weekday index reliably
  };
};

// Get weekday index (0=domingo..6=sábado) in Brasília timezone
const brasiliaWeekday = (d: Date) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  });
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[fmt.format(d)] ?? 0;
};

const formatTime = (d: Date) => {
  const p = brasiliaParts(d);
  return `${p.hour}:${p.minute}`;
};

const formatDayKey = (d: Date) => {
  const p = brasiliaParts(d);
  return `${p.year}-${p.month}-${p.day}`;
};

const formatDayLabel = (d: Date) => {
  const p = brasiliaParts(d);
  const weekday = WEEKDAYS[brasiliaWeekday(d)];
  return `Jogos de ${weekday} (${p.day}/${p.month})`;
};

export default function PublicResults({ results, players, phaseStatuses, moderators, viewMode = "list" }: Props) {
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");
  const [selectedRodada, setSelectedRodada] = useState<string>("__last__");

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const moderatorMap = useMemo(() => {
    const m = new Map<string, string>();
    moderators.forEach(mod => m.set(mod.user_id, mod.nome));
    return m;
  }, [moderators]);

  const displayName = (id: string) => {
    const p = playerMap.get(id);
    if (!p) return "Jogador desconhecido";
    const nick = p.nick_playroom?.trim();
    return nick || p.nome_completo;
  };

  const moderatorName = (uid: string | null) => {
    if (!uid) return "Não informado";
    return moderatorMap.get(uid) || "Usuário desconhecido";
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

  const availableRodadas = useMemo(() => {
    const set = new Set<number>();
    filtered.forEach(r => set.add(r.rodada));
    return Array.from(set).sort((a, b) => a - b);
  }, [filtered]);

  const lastRodada = availableRodadas.length > 0 ? availableRodadas[availableRodadas.length - 1] : null;

  // Reset rodada selection to "last" when fase changes
  useEffect(() => {
    setSelectedRodada("__last__");
  }, [selectedFase]);

  const effectiveRodada = useMemo(() => {
    if (selectedRodada === "__all__") return null;
    if (selectedRodada === "__last__") return lastRodada;
    const n = Number(selectedRodada);
    return Number.isFinite(n) ? n : lastRodada;
  }, [selectedRodada, lastRodada]);

  const rodadaFiltered = useMemo(
    () => effectiveRodada == null ? filtered : filtered.filter(r => r.rodada === effectiveRodada),
    [filtered, effectiveRodada],
  );

  // Group results into confrontos (pairs per registration)
  const confrontos = useMemo<Confronto[]>(() => {
    const map = new Map<string, Confronto>();
    for (const r of rodadaFiltered) {
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
          registered_by: r.registered_by,
          players: [r],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
  }, [rodadaFiltered]);

  // Group confrontos by day (most recent day first, most recent confronto first)
  const dias = useMemo(() => {
    const map = new Map<string, { key: string; date: Date; confrontos: Confronto[] }>();
    for (const c of confrontos) {
      const d = new Date(c.created_at);
      const k = formatDayKey(d);
      const existing = map.get(k);
      if (existing) {
        existing.confrontos.push(c);
      } else {
        map.set(k, { key: k, date: d, confrontos: [c] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [confrontos]);

  const phaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isInProgress = phaseStatus === "em_andamento" && filtered.length > 0;

  return (
    <div className="space-y-4">
      {filtered.length > 0 && !isInProgress && (
        <Alert className="border-green-500/50 bg-green-500/10" role="status">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription>
            <strong>Fase encerrada</strong> — resultados oficiais.
          </AlertDescription>
        </Alert>
      )}

      {availableRodadas.length > 0 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="rodada-filter" className="text-sm whitespace-nowrap">Rodada:</Label>
          <Select value={selectedRodada} onValueChange={setSelectedRodada}>
            <SelectTrigger id="rodada-filter" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__last__">
                Última rodada{lastRodada != null ? ` (${lastRodada})` : ""}
              </SelectItem>
              <SelectItem value="__all__">Todas as rodadas</SelectItem>
              {availableRodadas.map(r => (
                <SelectItem key={r} value={String(r)}>Rodada {r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {dias.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>{filtered.length === 0 ? "Nenhum resultado registrado para esta fase." : "Nenhum resultado registrado para esta rodada."}</p>
          </CardContent>
        </Card>
      ) : viewMode !== "table" && dias.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Acompanhe aqui os resultados individuais dos confrontos já ocorridos.
        </p>
      ) : null}

      {dias.length === 0 ? null : viewMode === "table" ? (
        <div className="space-y-8">
          {dias.map(dia => (
            <section key={dia.key} aria-labelledby={`dia-${dia.key}`}>
              <h2 id={`dia-${dia.key}`} className="text-lg font-semibold mb-3 pb-2 border-b">
                {formatDayLabel(dia.date)}
              </h2>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Confronto</TableHead>
                      {isFaseDeGrupos && <TableHead className="whitespace-nowrap">Grupo</TableHead>}
                      <TableHead className="whitespace-nowrap">Rodada</TableHead>
                      <TableHead className="whitespace-nowrap">Jogador</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Vitória</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Mesa</TableHead>
                      <TableHead className="whitespace-nowrap">Penalidades</TableHead>
                      <TableHead className="whitespace-nowrap">Moderador</TableHead>
                      <TableHead className="whitespace-nowrap">Hora</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dia.confrontos.flatMap(c => {
                      const horaPostagem = formatTime(new Date(c.created_at));
                      const mod = moderatorName(c.registered_by);
                      const colSpan = isFaseDeGrupos ? 9 : 8;
                      return c.players.map((r, idx) => (
                        <TableRow key={r.id} className={idx === 0 ? "border-t-2" : ""}>
                          {idx === 0 && (
                            <TableCell rowSpan={c.players.length} className="align-top font-medium">
                              {c.players.length < 2
                                ? `${displayName(c.players[0].player_id)} (avulso)`
                                : `${displayName(c.players[0].player_id)} x ${displayName(c.players[1].player_id)}`}
                            </TableCell>
                          )}
                          {idx === 0 && isFaseDeGrupos && (
                            <TableCell rowSpan={c.players.length} className="align-top">{c.grupo}</TableCell>
                          )}
                          {idx === 0 && (
                            <TableCell rowSpan={c.players.length} className="align-top">{c.rodada}</TableCell>
                          )}
                          <TableCell>{displayName(r.player_id)}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.pontos_jogo}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.pontos_mesa}</TableCell>
                          <TableCell className={r.penalidades !== "Sem penalidades" ? "text-destructive" : "text-muted-foreground"}>
                            {r.penalidades}
                          </TableCell>
                          {idx === 0 && (
                            <TableCell rowSpan={c.players.length} className="align-top">{mod}</TableCell>
                          )}
                          {idx === 0 && (
                            <TableCell rowSpan={c.players.length} className="align-top tabular-nums">{horaPostagem}</TableCell>
                          )}
                        </TableRow>
                      ));
                    })}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {dias.map(dia => (
            <section key={dia.key} aria-labelledby={`dia-${dia.key}`}>
              <h2
                id={`dia-${dia.key}`}
                className="text-lg font-semibold mb-3 pb-2 border-b"
              >
                {formatDayLabel(dia.date)}
              </h2>
              <ol className="space-y-3 list-none p-0">
                {dia.confrontos.map(c => {
                  const incompleto = c.players.length < 2;
                  const p1 = c.players[0];
                  const p2 = c.players[1];
                  const nome1 = displayName(p1.player_id);
                  const nome2 = p2 ? displayName(p2.player_id) : null;
                  const localizacao = isFaseDeGrupos
                    ? `rodada ${c.rodada}, grupo ${c.grupo}`
                    : `rodada ${c.rodada}`;
                  const tituloConfronto = incompleto
                    ? `${nome1} (registro avulso) — ${localizacao}`
                    : `${nome1} x ${nome2}, ${localizacao}`;
                  const horaPostagem = formatTime(new Date(c.created_at));

                  return (
                    <li key={c.key}>
                      <article aria-label={`Confronto ${tituloConfronto}, postado às ${horaPostagem}`}>
                        <Card>
                          <CardContent className="pt-4">
                            <header className="mb-3">
                              <h3 className="text-base font-semibold">
                                {tituloConfronto}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                Moderação: <span className="font-medium text-foreground">{moderatorName(c.registered_by)}</span>.
                              </p>
                            </header>
                            <ul className="space-y-2">
                              {c.players.map(r => {
                                const penalidade = r.penalidades !== "Sem penalidades";
                                const maxJogo = Math.max(...c.players.map(p => p.pontos_jogo));
                                const isWinner = c.players.length > 1 && r.pontos_jogo === maxJogo && c.players.filter(p => p.pontos_jogo === maxJogo).length === 1;
                                return (
                                  <li
                                    key={r.id}
                                    className="rounded-md border bg-muted/30 p-3"
                                  >
                                    <p className="font-medium">
                                      {isWinner ? "vitória de " : ""}{displayName(r.player_id)}
                                    </p>
                                    <p className="text-sm mt-1">
                                      <strong>{r.pontos_jogo}</strong> ponto{r.pontos_jogo === 1 ? "" : "s"} de vitória, <strong>{r.pontos_mesa}</strong> ponto{r.pontos_mesa === 1 ? "" : "s"} de mesa.
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
