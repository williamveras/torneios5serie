import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QualifiersResult, QualifierRow } from "@/lib/qualifiers";
import type { ViewMode } from "@/components/public/ViewModeToggle";

interface PlayerLike {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
  is_team?: boolean | null;
}

type TeamMembersMap = Record<string, { nome: string; nick: string | null }[]>;

interface Props {
  qualifiers: QualifiersResult;
  variant?: "admin" | "public";
  viewMode?: ViewMode;
  playerMesaMap?: Map<string, number>;
  players?: PlayerLike[];
  teamMembers?: TeamMembersMap;
}

const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const compactCardPadding = "p-3 min-[360px]:p-4";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

const naturalGroupSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
};

const formatTeamWithMembers = (
  baseName: string,
  player: PlayerLike | undefined,
  teamMembers: TeamMembersMap,
) => {
  if (!player?.is_team) return baseName;
  const members = teamMembers[player.id] || [];
  if (members.length === 0) return baseName;
  const labels = members.map((m) => (m.nick || "").trim() || (m.nome || "").trim()).filter(Boolean);
  if (labels.length === 0) return baseName;
  return `${baseName} (${labels.join(" x ")})`;
};

function TableSection({ title, rows, usePos, playerMesaMap, playerMap, teamMembers }: { title: string; rows: QualifierRow[]; usePos: "group" | "overall"; playerMesaMap?: Map<string, number>; playerMap?: Map<string, PlayerLike>; teamMembers: TeamMembersMap }) {
  return (
    <section>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <div className="rounded-md border overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Jogador</TableHead>
              <TableHead className="text-right whitespace-nowrap">Pts. vitória</TableHead>
              <TableHead className="text-right whitespace-nowrap">Pts. mesa</TableHead>
              <TableHead className="whitespace-nowrap">Penalidades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => {
              const pos = usePos === "group" ? s.groupPosition : s.position;
              const baseName = formatTeamWithMembers(s.nick || s.playerName, playerMap?.get(s.playerId), teamMembers);
              const mesa = playerMesaMap?.get(s.playerId);
              const displayName = mesa ? `${baseName}, mesa ${mesa}` : baseName;
              return (
                <TableRow key={`${s.grupo}-${s.playerId}`} className={s.hasPenalty ? "bg-destructive/5" : ""}>
                  <TableCell className="font-bold tabular-nums">{pos}º</TableCell>
                  <TableCell className={`font-medium ${noWrapText}`}>{displayName}</TableCell>
                  <TableCell className={`text-right tabular-nums ${noWrapText}`}>{s.pontosJogo}</TableCell>
                  <TableCell className={`text-right tabular-nums ${noWrapText}`}>{s.pontosMesa}</TableCell>
                  <TableCell className={`${noWrapText} ${s.hasPenalty ? "text-destructive" : "text-muted-foreground"}`}>
                    {s.penalidades}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function ListSection({ title, rows, usePos, playerMesaMap, playerMap, teamMembers }: { title: string; rows: QualifierRow[]; usePos: "group" | "overall"; playerMesaMap?: Map<string, number>; playerMap?: Map<string, PlayerLike>; teamMembers: TeamMembersMap }) {
  return (
    <section>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <ol className="space-y-2" aria-label="Classificados">
        {rows.map(s => {
          const pos = usePos === "group" ? s.groupPosition : s.position;
          const baseName = formatTeamWithMembers(s.nick || s.playerName, playerMap?.get(s.playerId), teamMembers);
          const mesa = playerMesaMap?.get(s.playerId);
          const displayName = mesa ? `${baseName}, mesa ${mesa}` : baseName;
          return (
            <li
              key={`${s.grupo}-${s.playerId}`}
              className={`rounded-md border bg-background flex items-start gap-3 min-w-0 overflow-hidden ${compactCardPadding} ${s.hasPenalty ? "bg-destructive/5" : ""}`}
            >
              <div className="font-bold tabular-nums text-lg min-w-[2.5rem]" aria-label={`Posição ${pos}`}>
                {pos}º
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${scrollLine}`}><span className="public-line-content">{keepTogether(displayName)}</span></p>
                <p className={`text-sm mt-0.5 ${scrollLine}`}>
                  <span className="public-line-content">{keepTogether(`${s.pontosJogo} pontos de vitória, ${s.pontosMesa} pontos de mesa.`)}</span>
                </p>
                <p className={`text-sm ${scrollLine} ${s.hasPenalty ? "text-destructive" : "text-muted-foreground"}`}>
                  <span className="public-line-content">{keepTogether(`Penalidades: ${s.penalidades}.`)}</span>
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default function QualifiersView({ qualifiers, viewMode = "list", playerMesaMap, players, teamMembers = {} }: Props) {
  const Section = viewMode === "table" ? TableSection : ListSection;
  const playerMap = (() => {
    const m = new Map<string, PlayerLike>();
    (players || []).forEach((p) => m.set(p.id, p));
    return m;
  })();

  if (!qualifiers.hasGroups) {
    return (
      <div className="space-y-6">
        <Section title="Classificados" rows={qualifiers.direct} usePos="overall" playerMesaMap={playerMesaMap} playerMap={playerMap} teamMembers={teamMembers} />
      </div>
    );
  }

  const groups = [...new Set(qualifiers.direct.map(r => r.grupo))].sort(naturalGroupSort);

  return (
    <div className="space-y-6">
      {groups.map(g => {
        const rows = qualifiers.direct
          .filter(r => r.grupo === g)
          .sort((a, b) => a.groupPosition - b.groupPosition);
        return <Section key={g} title={`Grupo ${g}`} rows={rows} usePos="group" playerMesaMap={playerMesaMap} playerMap={playerMap} teamMembers={teamMembers} />;
      })}
      {qualifiers.repescagem.length > 0 && (
        <Section
          title="Repescagem — melhores 6º colocados"
          rows={qualifiers.repescagem}
          usePos="overall"
          playerMesaMap={playerMesaMap}
          playerMap={playerMap}
          teamMembers={teamMembers}
        />
      )}
      {qualifiers.playoff.length > 0 && (
        <Section
          title="Vão para a Repescagem (mata-mata)"
          rows={qualifiers.playoff}
          usePos="overall"
          playerMesaMap={playerMesaMap}
          playerMap={playerMap}
          teamMembers={teamMembers}
        />
      )}
    </div>
  );
}

