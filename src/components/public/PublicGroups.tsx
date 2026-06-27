import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";
import { getPlayerDisplayName } from "@/lib/playerDisplay";

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  grupo?: string | null;
  is_team?: boolean | null;
}

interface ScheduledDrawLite {
  id: string;
  fase: string;
  scheduled_at: string;
  status: string;
  kind?: string | null;
}

interface Props {
  players: PlayerLite[];
  scheduledDraws?: ScheduledDrawLite[];
}

const formatGroupLabel = (grupo: string) =>
  /^\d+$/.test(grupo) ? `Grupo ${grupo}` : grupo;

export default function PublicGroups({ players, scheduledDraws = [] }: Props) {
  const groups = useMemo(() => {
    const map = new Map<string, PlayerLite[]>();
    for (const p of players) {
      if (!p.grupo) continue;
      const arr = map.get(p.grupo) || [];
      arr.push(p);
      map.set(p.grupo, arr);
    }
    const keys = Array.from(map.keys()).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
    return keys.map((grupo) => ({
      grupo,
      items: (map.get(grupo) || [])
        .slice()
        .sort((a, b) =>
          getPlayerDisplayName(a).localeCompare(getPlayerDisplayName(b)),
        ),
    }));
  }, [players]);

  if (groups.length === 0) {
    const pending = scheduledDraws
      .filter((s) => s.status === "pending" && (s.kind === "grupos" || s.fase === "Fase de Grupos"))
      .sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      )[0];
    if (pending) {
      const dt = new Date(pending.scheduled_at);
      return (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Users className="h-10 w-10 mx-auto mb-3 text-primary opacity-60" />
            <p className="text-lg font-semibold">Sorteio dos grupos agendado</p>
            <p className="text-muted-foreground">
              A distribuição dos grupos será sorteada automaticamente pelo sistema em:
            </p>
            <p className="text-xl font-semibold">
              {dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
              {" às "}
              {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-muted-foreground pt-2">
              Volte nesta página após o horário para ver a disposição dos grupos.
            </p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>A disposição dos grupos ainda não foi definida.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Segue a disposição dos grupos para a fase de grupos!
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {groups.map(({ grupo, items }) => (
          <Card key={grupo}>
            <CardContent className="pt-4 space-y-2">
              <h2 className="text-lg font-semibold">{formatGroupLabel(grupo)}</h2>
              <ul className="space-y-1">
                {items.map((p) => (
                  <li key={p.id} className="text-sm">
                    {getPlayerDisplayName(p)}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                {items.length} {items.length === 1 ? "participante" : "participantes"}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
