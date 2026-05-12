import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarDays, Clock } from "lucide-react";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"match_schedule">;
type Matchup = Tables<"matchups">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface Props {
  schedules: Schedule[];
  players: PlayerLite[];
  matchups: Matchup[];
  viewMode?: ViewMode;
}

const displayName = (p?: PlayerLite) => {
  if (!p) return "Jogador desconhecido";
  const nick = p.nick_playroom?.trim();
  return nick || p.nome_completo;
};

const formatDate = (iso: string) => {
  try {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
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

export default function PublicSchedule({ schedules, players, matchups, viewMode = "list" }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  // Determine current (latest) round from matchups
  const currentRound = useMemo(() => {
    const rounds = matchups.map(m => m.rodada).filter((r): r is number => r != null);
    if (rounds.length === 0) return null;
    return Math.max(...rounds);
  }, [matchups]);

  // Set of (sorted player-pair) keys belonging to the current round
  const currentRoundPairs = useMemo(() => {
    if (currentRound == null) return null;
    const set = new Set<string>();
    matchups.filter(m => m.rodada === currentRound).forEach(m => {
      const key = [m.player1_id, m.player2_id].sort().join("|");
      set.add(key);
    });
    return set;
  }, [matchups, currentRound]);

  const today = todaySaoPauloISO();
  const NO_DATE_KEY = "__sem_data__";

  const filteredSchedules = useMemo(() => {
    return schedules.filter(s => {
      // Hide past dates (date < today, São Paulo). Schedules with no date are kept.
      if (s.data_partida && s.data_partida < today) return false;
      return true;
    });
  }, [schedules, today]);

  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    const sorted = [...filteredSchedules].sort((a, b) => {
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
  }, [filteredSchedules]);

  const description = currentRound != null
    ? `Seguem abaixo os confrontos da rodada ${currentRound} e seus respectivos horários.`
    : "Seguem abaixo os confrontos e seus respectivos horários.";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{description}</p>

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum confronto pendente para exibir.</p>
          </CardContent>
        </Card>
      ) : viewMode === "table" ? (
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
                  {grouped.flatMap(([date, items]) =>
                    items.map(s => (
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
      ) : (
        grouped.map(([date, items]) => (
          <Card key={date}>
            <CardContent className="pt-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4" /> {date === NO_DATE_KEY ? "Sem data definida" : formatDate(date)}
              </h3>
              <div className="space-y-2">
                {items.map(s => (
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
        ))
      )}
    </div>
  );
}
