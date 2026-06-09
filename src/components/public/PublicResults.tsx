import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { FASES } from "@/lib/constants";
import { getActivePublicPhase, isGroupPhase, buildMesaMap, pairKey } from "@/lib/phase";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type PhaseStatus = Tables<"phase_status">;
type Matchup = Tables<"matchups">;

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
  matchups?: Matchup[];
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
const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const compactCardPadding = "p-3 min-[360px]:p-4";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

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

export default function PublicResults({ results, players, matchups = [], phaseStatuses, moderators, viewMode = "list" }: Props) {
  const activeFase = useMemo(() => getActivePublicPhase(phaseStatuses), [phaseStatuses]);

  const availableFases = useMemo(() => {
    const set = new Set<string>(results.map(r => r.fase || "Fase de Grupos"));
    set.add(activeFase);
    return FASES.filter(f => set.has(f));
  }, [results, activeFase]);

  // Default selection: active phase if it has results, otherwise the latest phase with results.
  const defaultFase = useMemo(() => {
    const fasesWithResults = new Set(results.map(r => r.fase || "Fase de Grupos"));
    if (fasesWithResults.has(activeFase)) return activeFase;
    const ordered = FASES.filter(f => fasesWithResults.has(f));
    return ordered.length > 0 ? ordered[ordered.length - 1] : activeFase;
  }, [results, activeFase]);

  const [selectedFase, setSelectedFase] = useState<string>(defaultFase);
  const [selectedRodada, setSelectedRodada] = useState<string>("__all__");

  useEffect(() => {
    setSelectedFase(defaultFase);
  }, [defaultFase]);

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

  const filtered = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === selectedFase),
    [results, selectedFase],
  );

  const isFaseDeGrupos = isGroupPhase(selectedFase);

  // Mesa map for non-group phases (matchup order = mesa number)
  const mesaMap = useMemo(
    () => buildMesaMap(matchups as any, selectedFase),
    [matchups, selectedFase],
  );

  const availableRodadas = useMemo(() => {
    if (!isFaseDeGrupos) return [] as number[];
    const set = new Set<number>();
    filtered.forEach(r => set.add(r.rodada));
    return Array.from(set).sort((a, b) => a - b);
  }, [filtered, isFaseDeGrupos]);

  const lastRodada = availableRodadas.length > 0 ? availableRodadas[availableRodadas.length - 1] : null;

  useEffect(() => {
    setSelectedRodada("__all__");
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

  // Compute grouping key for each confronto: rodada (group phase) or mesa (non-group)
  const confrontoGroupKey = (c: Confronto): number => {
    if (isFaseDeGrupos) return c.rodada;
    if (c.players.length < 2) return 0;
    const mesa = mesaMap.get(pairKey(c.players[0].player_id, c.players[1].player_id));
    return mesa ?? 0;
  };

  const groupLabel = (n: number) => isFaseDeGrupos ? `Rodada ${n}` : (n > 0 ? `Mesa ${n}` : "Sem mesa");

  // Group confrontos by rodada/mesa (desc), then by day (most recent first)
  const rodadasGroups = useMemo(() => {
    const rodMap = new Map<number, Map<string, { key: string; date: Date; confrontos: Confronto[] }>>();
    for (const c of confrontos) {
      const d = new Date(c.created_at);
      const dayKey = formatDayKey(d);
      const gk = confrontoGroupKey(c);
      let dayMap = rodMap.get(gk);
      if (!dayMap) {
        dayMap = new Map();
        rodMap.set(gk, dayMap);
      }
      const existing = dayMap.get(dayKey);
      if (existing) {
        existing.confrontos.push(c);
      } else {
        dayMap.set(dayKey, { key: dayKey, date: d, confrontos: [c] });
      }
    }
    return Array.from(rodMap.entries())
      .sort((a, b) => isFaseDeGrupos ? b[0] - a[0] : a[0] - b[0])
      .map(([rodada, dayMap]) => ({
        rodada,
        dias: Array.from(dayMap.values()).sort((a, b) => b.key.localeCompare(a.key)),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confrontos, isFaseDeGrupos, mesaMap]);

  const defaultOpenRodadas = useMemo<string[]>(
    () => [],
    [],
  );

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

      {availableFases.length > 1 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="fase-filter" className="text-sm whitespace-nowrap">Fase:</Label>
          <Select value={selectedFase} onValueChange={setSelectedFase}>
            <SelectTrigger id="fase-filter" className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableFases.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {isFaseDeGrupos && availableRodadas.length > 0 && (
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

      {rodadasGroups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>{filtered.length === 0 ? "Nenhum resultado registrado para esta fase." : "Nenhum resultado registrado para esta rodada."}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {isFaseDeGrupos
              ? "Acompanhe aqui os resultados individuais dos confrontos já ocorridos. Toque em uma rodada para expandir."
              : `Resultados da ${selectedFase}, organizados por Mesa. Toque em uma mesa para expandir.`}
          </p>
          {isFaseDeGrupos ? (
            <Accordion type="multiple" defaultValue={defaultOpenRodadas} className="space-y-2">
              {rodadasGroups.map(group => {
                const totalConfrontos = group.dias.reduce((acc, d) => acc + d.confrontos.length, 0);
                const headerLabel = groupLabel(group.rodada);
                return (
                  <AccordionItem
                    key={`rodada-${group.rodada}`}
                    value={`rodada-${group.rodada}`}
                    className="border rounded-md bg-card"
                  >
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-base font-semibold">{headerLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          ({totalConfrontos} {totalConfrontos === 1 ? "confronto" : "confrontos"})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4 min-[360px]:px-4">
                      {viewMode === "table" ? (
...
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            <div className="space-y-6">
              {rodadasGroups.flatMap(group => group.dias).map(dia => (
                viewMode === "table" ? (
                  <section key={dia.key} aria-labelledby={`dia-flat-${dia.key}`}>
                    <h3 id={`dia-flat-${dia.key}`} className="text-sm font-semibold mb-2 pb-1 border-b">
                      {formatDayLabel(dia.date)}
                    </h3>
                    <div className="rounded-md border overflow-x-auto">
                      <Table className="min-w-max">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap">Mesa</TableHead>
                            <TableHead className="whitespace-nowrap">Confronto</TableHead>
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
                            const mesaNum = c.players.length >= 2
                              ? mesaMap.get(pairKey(c.players[0].player_id, c.players[1].player_id))
                              : undefined;
                            return c.players.map((r, idx) => (
                              <TableRow key={r.id} className={idx === 0 ? "border-t-2" : ""}>
                                {idx === 0 && (
                                  <TableCell rowSpan={c.players.length} className={`align-top font-medium ${noWrapText}`}>
                                    {mesaNum ? `Mesa ${mesaNum}` : "—"}
                                  </TableCell>
                                )}
                                {idx === 0 && (
                                  <TableCell rowSpan={c.players.length} className={`align-top font-medium ${noWrapText}`}>
                                    {c.players.length < 2
                                      ? `${displayName(c.players[0].player_id)} (avulso)`
                                      : `${displayName(c.players[0].player_id)} x ${displayName(c.players[1].player_id)}`}
                                  </TableCell>
                                )}
                                <TableCell className={noWrapText}>{displayName(r.player_id)}</TableCell>
                                <TableCell className={`text-right tabular-nums ${noWrapText}`}>{r.pontos_jogo}</TableCell>
                                <TableCell className={`text-right tabular-nums ${noWrapText}`}>{r.pontos_mesa}</TableCell>
                                <TableCell className={`${noWrapText} ${r.penalidades !== "Sem penalidades" ? "text-destructive" : "text-muted-foreground"}`}>
                                  {r.penalidades}
                                </TableCell>
                                {idx === 0 && (
                                  <TableCell rowSpan={c.players.length} className={`align-top ${noWrapText}`}>{mod}</TableCell>
                                )}
                                {idx === 0 && (
                                  <TableCell rowSpan={c.players.length} className={`align-top tabular-nums ${noWrapText}`}>{horaPostagem}</TableCell>
                                )}
                              </TableRow>
                            ));
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </section>
                ) : (
                  <section key={dia.key} aria-labelledby={`dia-flat-${dia.key}`}>
                    <h3 id={`dia-flat-${dia.key}`} className="text-sm font-semibold mb-2 pb-1 border-b">
                      {formatDayLabel(dia.date)}
                    </h3>
                    <ol className="space-y-3 list-none p-0">
                      {dia.confrontos.map(c => {
                        const incompleto = c.players.length < 2;
                        const p1 = c.players[0];
                        const p2 = c.players[1];
                        const nome1 = displayName(p1.player_id);
                        const nome2 = p2 ? displayName(p2.player_id) : null;
                        const mesa = p2 ? mesaMap.get(pairKey(p1.player_id, p2.player_id)) : undefined;
                        const mesaLabel = mesa ? `Mesa ${mesa}` : "Mesa —";
                        const tituloConfronto = incompleto
                          ? `${mesaLabel}: ${nome1} (registro avulso)`
                          : `${mesaLabel}: ${nome1} x ${nome2}`;
                        const horaPostagem = formatTime(new Date(c.created_at));

                        return (
                          <li key={c.key}>
                            <article aria-label={`Confronto ${tituloConfronto}, postado às ${horaPostagem}`}>
                              <Card>
                                <CardContent className="p-3 min-[360px]:p-4">
                                  <header className="mb-3">
                                    <h4 className={`text-base font-semibold ${scrollLine}`}>
                                      <span className="public-line-content">{keepTogether(tituloConfronto)}</span>
                                    </h4>
                                    <p className={`text-sm text-muted-foreground mt-1 ${scrollLine}`}>
                                      <span className="public-line-content">{keepTogether("Moderação:")} <span className="font-medium text-foreground">{keepTogether(moderatorName(c.registered_by))}</span>.</span>
                                    </p>
                                  </header>
                                  <ul className="space-y-2 min-w-0">
                                    {c.players.map(r => {
                                      const penalidade = r.penalidades !== "Sem penalidades";
                                      const maxJogo = Math.max(...c.players.map(p => p.pontos_jogo));
                                      const isWinner = c.players.length > 1 && r.pontos_jogo === maxJogo && c.players.filter(p => p.pontos_jogo === maxJogo).length === 1;
                                      return (
                                        <li
                                          key={r.id}
                                          className={`rounded-md border bg-muted/30 min-w-0 overflow-hidden ${compactCardPadding}`}
                                        >
                                          <p className={`font-medium ${scrollLine}`}>
                                            <span className="public-line-content">{keepTogether(`${isWinner ? "vitória de " : ""}${displayName(r.player_id)}`)}</span>
                                          </p>
                                          <p className={`text-sm mt-1 ${scrollLine}`}>
                                            <span className="public-line-content">{keepTogether(`${r.pontos_jogo} ponto${r.pontos_jogo === 1 ? "" : "s"} de vitória, ${r.pontos_mesa} ponto${r.pontos_mesa === 1 ? "" : "s"} de mesa.`)}</span>
                                          </p>

                                          {penalidade && (
                                            <p className={`text-sm text-destructive ${scrollLine}`}>
                                              <span className="public-line-content">{keepTogether(`Penalidades: ${r.penalidades}.`)}</span>
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
                )
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
