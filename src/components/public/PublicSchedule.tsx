import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Clock } from "lucide-react";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";
import { computeCurrentRound } from "@/lib/rounds";
import { getActivePublicPhase, isGroupPhase, buildMesaMap, pairKey } from "@/lib/phase";

type Schedule = Tables<"match_schedule">;
type Matchup = Tables<"matchups">;
type MatchResult = Tables<"match_results">;
type PhaseStatus = Tables<"phase_status">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface Props {
  schedules: Schedule[];
  players: PlayerLite[];
  matchups: Matchup[];
  results?: MatchResult[];
  phaseStatuses?: PhaseStatus[];
  numeroRodadas?: number | null;
  viewMode?: ViewMode;
}

const displayName = (p?: PlayerLite) => {
  if (!p) return "Jogador desconhecido";
  const nick = p.nick_playroom?.trim();
  return nick || p.nome_completo;
};

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const formatDate = (iso: string) => {
  try {
    const [y, m, d] = iso.split("-");
    const dt = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 12, 0, 0);
    const weekday = WEEKDAYS[dt.getDay()];
    return `${weekday}, ${d}/${m}/${y}`;
  } catch { return iso; }
};

const formatGroupLabel = (grupo: string) => {
  if (/^\d+$/.test(grupo)) return `Grupo ${grupo}`;
  return grupo;
};

const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const compactCardPadding = "p-3 min-[360px]:p-4";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

const todaySaoPauloISO = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date());
};

export default function PublicSchedule({ schedules, players, matchups, results = [], phaseStatuses = [], numeroRodadas = null, viewMode = "list" }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const activeFase = useMemo(() => getActivePublicPhase(phaseStatuses), [phaseStatuses]);
  const isGroup = isGroupPhase(activeFase);

  // === Non-group phase: render by Mesa ===
  // Inclui também a "Disputa de 3º Lugar" (fase lateral), para que apareça
  // junto com a Final na visualização pública.
  const SIDE_FASE_3RD = "Disputa de 3º Lugar";
  const includeThirdPlace = !isGroup && matchups.some(m => (m.fase || "") === SIDE_FASE_3RD);
  const mesaMap = useMemo(() => buildMesaMap(matchups as any, activeFase), [matchups, activeFase]);
  const mesaMap3rd = useMemo(() => buildMesaMap(matchups as any, SIDE_FASE_3RD), [matchups]);

  const eliminationItems = useMemo(() => {
    if (isGroup) return [] as Array<{ mesa: number; fase: string; player1_id: string; player2_id: string; schedule: Schedule | null }>;
    const today = todaySaoPauloISO();
    const fasesToShow = [activeFase, ...(includeThirdPlace && activeFase !== SIDE_FASE_3RD ? [SIDE_FASE_3RD] : [])];
    const items: Array<{ mesa: number; fase: string; player1_id: string; player2_id: string; schedule: Schedule | null }> = [];
    for (const fase of fasesToShow) {
      const phaseMatchups = matchups.filter(m => (m.fase || "Fase de Grupos") === fase);
      const map = fase === SIDE_FASE_3RD ? mesaMap3rd : mesaMap;
      for (const mu of phaseMatchups) {
        const mesa = map.get(pairKey(mu.player1_id, mu.player2_id)) ?? 9999;
        const sched = schedules.find(s =>
          pairKey(s.player1_id, s.player2_id) === pairKey(mu.player1_id, mu.player2_id)
        ) || null;
        items.push({ mesa, fase, player1_id: mu.player1_id, player2_id: mu.player2_id, schedule: sched });
      }
    }
    // Hide past matches (date already gone)
    const filtered = items.filter(it => {
      const d = it.schedule?.data_partida;
      if (!d) return true;
      return d >= today;
    });
    // Ordena: fase principal antes da 3º Lugar, depois por mesa.
    return filtered.sort((a, b) => {
      if (a.fase !== b.fase) return a.fase === SIDE_FASE_3RD ? 1 : -1;
      return a.mesa - b.mesa;
    });
  }, [isGroup, matchups, schedules, mesaMap, mesaMap3rd, activeFase, includeThirdPlace]);

  // === Group phase (existing rounds-based logic) ===
  const { currentRound, totalRounds } = useMemo(
    () => computeCurrentRound(matchups as any, results as any, numeroRodadas),
    [matchups, results, numeroRodadas],
  );

  const pairsByRound = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const mu of matchups) {
      if (mu.rodada == null) continue;
      if ((mu.fase || "Fase de Grupos") !== "Fase de Grupos") continue;
      const key = pairKey(mu.player1_id, mu.player2_id);
      const set = m.get(mu.rodada) || new Set<string>();
      set.add(key);
      m.set(mu.rodada, set);
    }
    return m;
  }, [matchups]);

  const today = todaySaoPauloISO();
  const NO_DATE_KEY = "__sem_data__";

  const resolveRound = (s: Schedule): number | null => {
    if (s.rodada != null) return s.rodada;
    const key = pairKey(s.player1_id, s.player2_id);
    for (const [r, set] of pairsByRound.entries()) {
      if (set.has(key)) return r;
    }
    return null;
  };

  const visibleSchedulesByRound = useMemo(() => {
    if (!isGroup) return [] as Array<{ round: number; items: Schedule[] }>;
    if (currentRound == null) return [];
    const byRound = new Map<number, Schedule[]>();
    for (const s of schedules) {
      if (s.data_partida && s.data_partida < today) continue;
      const r = resolveRound(s);
      if (r == null) continue;
      if (r < currentRound) continue;
      const arr = byRound.get(r) || [];
      arr.push(s);
      byRound.set(r, arr);
    }
    if (!byRound.has(currentRound)) byRound.set(currentRound, []);
    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    return rounds.map(round => ({ round, items: byRound.get(round) || [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup, schedules, currentRound, pairsByRound, today]);

  const groupByDate = (items: Schedule[]) => {
    const map = new Map<string, Schedule[]>();
    const sorted = [...items].sort((a, b) => {
      const da = a.data_partida || "9999-12-31";
      const db = b.data_partida || "9999-12-31";
      if (da !== db) return da.localeCompare(db);
      const ha = a.horario || "99:99";
      const hb = b.horario || "99:99";
      return ha.localeCompare(hb);
    });
    for (const s of sorted) {
      const key = s.data_partida || NO_DATE_KEY;
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries());
  };

  const description = isGroup
    ? "Atenção aos confrontos e horários dos jogos ainda a decorrer:"
    : `Confrontos da ${activeFase}.`;

  // ===== Elimination (non-group) rendering =====
  if (!isGroup) {
    if (eliminationItems.length === 0) {
      return (
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">{description}</p>
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Ainda não há confrontos cadastrados para a {activeFase}.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    const dateBuckets = new Map<string, typeof eliminationItems>();
    for (const it of eliminationItems) {
      const key = it.schedule?.data_partida || NO_DATE_KEY;
      const arr = dateBuckets.get(key) || [];
      arr.push(it);
      dateBuckets.set(key, arr);
    }
    const dateEntries = Array.from(dateBuckets.entries())
      .sort(([a], [b]) => {
        if (a === NO_DATE_KEY) return 1;
        if (b === NO_DATE_KEY) return -1;
        return a.localeCompare(b);
      })
      .map(([date, items]) => [
        date,
        [...items].sort((a, b) => {
          const ha = a.schedule?.horario || "99:99";
          const hb = b.schedule?.horario || "99:99";
          return ha.localeCompare(hb);
        }),
      ] as const);

    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">{description}</p>

        {viewMode === "table" ? (
          <Card>
            <CardContent className="pt-4">
              <div className="rounded-md border overflow-x-auto">
                <Table className="min-w-max">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Data</TableHead>
                      <TableHead className="whitespace-nowrap">Mesa</TableHead>
                      <TableHead className="whitespace-nowrap">Confronto</TableHead>
                      <TableHead className="whitespace-nowrap">Horário</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dateEntries.flatMap(([date, items]) =>
                      items.map(it => (
                        <TableRow key={`${date}-${it.fase}-${it.mesa}-${it.player1_id}`}>
                          <TableCell className="whitespace-nowrap">
                            {date === NO_DATE_KEY ? "Sem data definida" : formatDate(date)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap tabular-nums">
                            Mesa {it.mesa}
                            {it.fase === SIDE_FASE_3RD && (
                              <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">(3º lugar)</span>
                            )}
                          </TableCell>
                          <TableCell className={`font-medium ${noWrapText}`}>
                            {displayName(playerMap.get(it.player1_id))} x {displayName(playerMap.get(it.player2_id))}
                          </TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            {it.schedule?.horario ? it.schedule.horario.slice(0, 5) : (it.schedule?.observacao || "A definir")}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {dateEntries.map(([date, items]) => (
              <Card key={date}>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> {date === NO_DATE_KEY ? "Sem data definida" : formatDate(date)}
                  </h3>
                  <div className="space-y-2">
                    {items.map(it => (
                      <div key={`${it.fase}-${it.mesa}-${it.player1_id}`} className={`rounded-md border bg-muted/30 min-w-0 overflow-hidden ${compactCardPadding}`}>
                        <h3 className={`text-base sm:text-lg font-semibold ${scrollLine}`}>
                          <span className="public-line-content">
                            <span>{keepTogether(displayName(playerMap.get(it.player1_id)))}</span>{" "}
                            <span className="text-muted-foreground font-normal">x</span>{" "}
                            <span>{keepTogether(displayName(playerMap.get(it.player2_id)))}</span>{" "}
                            <span className="text-muted-foreground font-normal text-sm">{keepTogether(`(mesa ${it.mesa})`)}</span>
                            {it.fase === SIDE_FASE_3RD && (
                              <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">— Disputa de 3º Lugar</span>
                            )}
                          </span>
                        </h3>
                        <div className={`text-sm font-medium tabular-nums mt-1 ${scrollLine}`}>
                          <span className="public-line-content">
                            <Clock className="inline h-3.5 w-3.5 align-[-2px]" />{" "}
                            {keepTogether(it.schedule?.horario ? it.schedule.horario.slice(0, 5) : (it.schedule?.observacao || "A definir"))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== Group phase rendering (existing) =====
  const totalItems = visibleSchedulesByRound.reduce((acc, r) => acc + r.items.length, 0);

  const renderRoundTable = (items: Schedule[]) => (
    <Card>
      <CardContent className="pt-4">
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">Data</TableHead>
                <TableHead className="whitespace-nowrap">Grupo</TableHead>
                <TableHead className="whitespace-nowrap">Confronto</TableHead>
                <TableHead className="whitespace-nowrap">Horário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupByDate(items).flatMap(([date, rows]) =>
                rows.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap">
                      {date === NO_DATE_KEY ? "Sem data definida" : formatDate(date)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatGroupLabel(s.grupo)}</TableCell>
                    <TableCell className={`font-medium ${noWrapText}`}>
                      {displayName(playerMap.get(s.player1_id))} x {displayName(playerMap.get(s.player2_id))}
                    </TableCell>
                    <TableCell className="tabular-nums whitespace-nowrap">
                      {s.horario ? s.horario.slice(0, 5) : (s.observacao || "A definir")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  const renderRoundList = (items: Schedule[]) => (
    <div className="space-y-4">
      {groupByDate(items).map(([date, rows]) => (
        <Card key={date}>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {date === NO_DATE_KEY ? "Sem data definida" : formatDate(date)}
            </h3>
            <div className="space-y-2">
              {rows.map(s => (
                <div key={s.id} className={`rounded-md border bg-muted/30 min-w-0 overflow-hidden ${compactCardPadding}`}>
                  <h3 className={`text-base sm:text-lg font-semibold ${scrollLine}`}>
                    <span className="public-line-content">
                      <span>{keepTogether(displayName(playerMap.get(s.player1_id)))}</span>{" "}
                      <span className="text-muted-foreground font-normal">x</span>{" "}
                      <span>{keepTogether(displayName(playerMap.get(s.player2_id)))}</span>{" "}
                      <span className="text-muted-foreground font-normal text-sm">{keepTogether(`(${formatGroupLabel(s.grupo).toLowerCase()})`)}</span>
                    </span>
                  </h3>
                  <div className={`text-sm font-medium tabular-nums mt-1 ${scrollLine}`}>
                    <span className="public-line-content">
                      <Clock className="inline h-3.5 w-3.5 align-[-2px]" />{" "}
                      {keepTogether(s.horario ? s.horario.slice(0, 5) : (s.observacao || "A definir"))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">{description}</p>

      {totalItems === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum confronto pendente para exibir.</p>
          </CardContent>
        </Card>
      ) : (
        visibleSchedulesByRound.map(({ round, items }) => (
          <section key={round} className="space-y-3">
            <h2 className="text-lg font-semibold">
              Rodada {round}
              {totalRounds ? ` de ${totalRounds}` : ""}
              {round === currentRound ? " (rodada atual)" : " (rodada futura)"}
            </h2>
            {items.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground text-sm">
                  Nenhum confronto pendente nesta rodada.
                </CardContent>
              </Card>
            ) : viewMode === "table" ? (
              renderRoundTable(items)
            ) : (
              renderRoundList(items)
            )}
          </section>
        ))
      )}
    </div>
  );
}
