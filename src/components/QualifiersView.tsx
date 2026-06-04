import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QualifiersResult, QualifierRow } from "@/lib/qualifiers";

interface Props {
  qualifiers: QualifiersResult;
  variant?: "admin" | "public";
}

function Section({ title, rows, showGroup }: { title: string; rows: QualifierRow[]; showGroup: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow>
              <TableHead className="w-14">#</TableHead>
              <TableHead>Jogador</TableHead>
              {showGroup && <TableHead className="whitespace-nowrap">Grupo</TableHead>}
              {showGroup && <TableHead className="whitespace-nowrap">Pos. no grupo</TableHead>}
              <TableHead className="text-right whitespace-nowrap">Pts. vitória</TableHead>
              <TableHead className="text-right whitespace-nowrap">Pts. mesa</TableHead>
              <TableHead className="whitespace-nowrap">Penalidades</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => (
              <TableRow key={`${s.grupo}-${s.playerId}`} className={s.hasPenalty ? "bg-destructive/5" : ""}>
                <TableCell className="font-bold tabular-nums">{s.position}º</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{s.nick || s.playerName}</TableCell>
                {showGroup && <TableCell className="whitespace-nowrap">{s.grupo}</TableCell>}
                {showGroup && <TableCell className="whitespace-nowrap tabular-nums">{s.groupPosition}º</TableCell>}
                <TableCell className="text-right tabular-nums">{s.pontosJogo}</TableCell>
                <TableCell className="text-right tabular-nums">{s.pontosMesa}</TableCell>
                <TableCell className={s.hasPenalty ? "text-destructive" : "text-muted-foreground"}>{s.penalidades}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

export default function QualifiersView({ qualifiers }: Props) {
  return (
    <div className="space-y-6">
      <Section
        title="Classificados diretamente (5 primeiros de cada grupo)"
        rows={qualifiers.direct}
        showGroup={qualifiers.hasGroups}
      />
      {qualifiers.hasGroups && (
        <Section
          title="Classificados via repescagem (18 melhores 6º colocados)"
          rows={qualifiers.repescagem}
          showGroup
        />
      )}
    </div>
  );
}
