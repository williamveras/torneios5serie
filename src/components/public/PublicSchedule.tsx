import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Schedule = Tables<"match_schedule">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface Props {
  schedules: Schedule[];
  players: PlayerLite[];
}

const displayName = (p?: PlayerLite) => {
  if (!p) return "Jogador desconhecido";
  const nick = p.nick_playroom?.trim();
  return nick ? `${p.nome_completo} (${nick})` : p.nome_completo;
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

export default function PublicSchedule({ schedules, players }: Props) {
  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const grouped = useMemo(() => {
    const map = new Map<string, Schedule[]>();
    const sorted = [...schedules].sort((a, b) => {
      if (a.data_partida !== b.data_partida) return a.data_partida.localeCompare(b.data_partida);
      return a.horario.localeCompare(b.horario);
    });
    for (const s of sorted) {
      const arr = map.get(s.data_partida) || [];
      arr.push(s);
      map.set(s.data_partida, arr);
    }
    return Array.from(map.entries());
  }, [schedules]);

  if (schedules.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>Nenhuma partida agendada ainda.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map(([date, items]) => (
        <Card key={date}>
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> {formatDate(date)}
            </h3>
            <div className="space-y-2">
              {items.map(s => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                  <div className="flex items-center gap-1 text-sm font-medium tabular-nums min-w-[60px]">
                    <Clock className="h-3.5 w-3.5" /> {s.horario.slice(0, 5)}
                  </div>
                  <div className="text-xs px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {formatGroupLabel(s.grupo)}
                  </div>
                  <div className="flex-1 text-sm">
                    <span className="font-medium">{displayName(playerMap.get(s.player1_id))}</span>
                    <span className="text-muted-foreground mx-2">vs</span>
                    <span className="font-medium">{displayName(playerMap.get(s.player2_id))}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
