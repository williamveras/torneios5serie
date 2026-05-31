import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Clock } from "lucide-react";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";
import { computeCurrentRound } from "@/lib/rounds";

type Schedule = Tables<"match_schedule">;
type Matchup = Tables<"matchups">;
type MatchResult = Tables<"match_results">;

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
    // Use noon to avoid timezone edge cases shifting the weekday
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

// Today in São Paulo timezone (YYYY-MM-DD)
const todaySaoPauloISO = () => {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric", month: "2-digit", day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
};

export default function PublicSchedule({ schedules, players, matchups, results = [], numeroRodadas = null, viewMode = "list" }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  // Compute current round using numero_rodadas + results (with legacy fallback)
  const { currentRound, totalRounds, phaseComplete } = useMemo(
    () => computeCurrentRound(matchups as any, results as any, numeroRodadas),
    [matchups, results, numeroRodadas],
  );


  // Map roundNumber -> Set of sorted-pair keys (from matchups)
  const pairsByRound = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const mu of matchups) {
      if (mu.rodada == null) continue;
      const key = [mu.player1_id, mu.player2_id].sort().join("|");
      const set = m.get(mu.rodada) || new Set<string>();
      set.add(key);
      m.set(mu.rodada, set);
    }
    return m;
  }, [matchups]);

  const today = todaySaoPauloISO();
  const NO_DATE_KEY = "__sem_data__";

  // Resolve each schedule to a round number (prefer s.rodada, fallback to matchup pair lookup)
  const resolveRound = (s: Schedule): number | null => {
    if (s.rodada != null) return s.rodada;
    const key = [s.player1_id, s.player2_id].sort().join("|");
    for (const [r, set] of pairsByRound.entries()) {
      if (set.has(key)) return r;
    }
    return null;
  };

  // Determine which rounds to show: current round + any future rounds that already have schedules
  const visibleSchedulesByRound = useMemo(() => {
    if (currentRound == null) return [] as Array<{ round: number; items: Schedule[] }>;
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
    // Always include currentRound entry (even if empty) so the message renders
    if (!byRound.has(currentRound)) byRound.set(currentRound, []);
    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    return rounds.map(round => ({ round, items: byRound.get(round) || [] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedules, currentRound, pairsByRound, today]);

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

  const description = "Atenção aos confrontos e horários dos jogos ainda a decorrer:";

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
