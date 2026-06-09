import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Trophy } from "lucide-react";
import type { PhaseProjection } from "@/lib/phaseProjection";

interface Props {
  /** Sequência completa de fases eliminatórias projetadas. */
  projection: PhaseProjection[];
  /** Total de classificados saídos da Fase de Grupos. */
  classifiedCount: number;
  /** Fase atualmente ativa (destaque). Opcional. */
  currentFase?: string | null;
  /** Lista de fases já concluídas. Opcional. */
  concludedFases?: string[];
  /** Título customizado. */
  title?: string;
}

/**
 * Roadmap visual das fases eliminatórias projetadas a partir do número
 * de classificados. Mostra "Segunda Fase 128 → 64", etc., destacando a
 * fase atual e marcando as concluídas.
 */
export default function PhaseRoadmap({
  projection,
  classifiedCount,
  currentFase,
  concludedFases = [],
  title = "Próximas fases previstas",
}: Props) {
  if (projection.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Projeção automática a partir de {classifiedCount} classificado{classifiedCount === 1 ? "" : "s"} da Fase de Grupos.
        </p>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-wrap items-center gap-2">
          {projection.map((p, i) => {
            const isCurrent = currentFase === p.fase;
            const isDone = concludedFases.includes(p.fase);
            return (
              <li key={p.fase} className="flex items-center gap-2">
                <div
                  className={[
                    "rounded-md border px-3 py-2 text-sm leading-tight",
                    isCurrent ? "border-primary bg-primary/10 font-medium" : "",
                    isDone && !isCurrent ? "border-green-500/40 bg-green-500/5 text-muted-foreground line-through decoration-1" : "",
                    !isCurrent && !isDone ? "bg-muted/40" : "",
                  ].join(" ")}
                >
                  <div className="font-medium">{p.fase}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.isFinal ? `${p.from} → 🏆 campeão` : `${p.from} → ${p.to}`}
                  </div>
                </div>
                {i < projection.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
