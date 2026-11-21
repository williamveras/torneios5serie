import { t, usePublicLanguage } from "@/lib/publicI18n";
import { criterionLabels, validCriteria } from "@/lib/tiebreakers";
import type { StandingRow } from "@/lib/standings";

export function RankingMetrics({ row }: { row: StandingRow }) {
  usePublicLanguage();
  if (row.wins === undefined) return null;
  return <span className="block text-xs text-muted-foreground whitespace-normal">{t("Vitórias: {0}; ocorrências de penalidade: {1}.", { "0": row.wins, "1": row.penaltyCount || 0 })}</span>;
}
export default function RankingCriteria({ criteria }: { criteria?: string[] | null }) {
  usePublicLanguage();
  if (!validCriteria(criteria)) return null;
  return <p className="text-sm text-muted-foreground">{t("Critérios de classificação:")} {criteria.map(c => t(criterionLabels[c])).join(" → ")}</p>;
}
