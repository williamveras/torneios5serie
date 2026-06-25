import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FASES, isSideFase } from "@/lib/constants";
import { nextPhaseName } from "@/lib/qualifiers";
import type { Tables } from "@/integrations/supabase/types";

type PhaseStatus = Tables<"phase_status">;

/**
 * Returns the dynamic label for the "Classificação" tab.
 * When the latest fase (by FASES order) that has a status is `concluida`
 * and has a next fase, the label becomes "Classificados para a <próxima fase>".
 * Otherwise returns "Classificação".
 *
 * Also returns the concluded fase name (or null) so consumers can adjust behavior.
 */
export function useStandingsTabLabel(tournamentId: string, initial?: PhaseStatus[]) {
  const [statuses, setStatuses] = useState<PhaseStatus[]>(initial || []);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    supabase
      .from("phase_status")
      .select("*")
      .eq("tournament_id", tournamentId)
      .then(({ data }) => {
        if (!cancelled && data) setStatuses(data);
      });
    const channel = supabase
      .channel(`phase_status_${tournamentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "phase_status", filter: `tournament_id=eq.${tournamentId}` },
        () => {
          supabase
            .from("phase_status")
            .select("*")
            .eq("tournament_id", tournamentId)
            .then(({ data }) => {
              if (!cancelled && data) setStatuses(data);
            });
        },
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tournamentId, initial]);

  // Find the latest concluded fase (by FASES order)
  let concludedFase: string | null = null;
  for (let i = FASES.length - 1; i >= 0; i--) {
    const f = FASES[i];
    const s = statuses.find(p => p.fase === f);
    if (s?.status === "concluida") {
      concludedFase = f;
      break;
    }
  }

  const next = concludedFase ? nextPhaseName(concludedFase) : "";
  const label = concludedFase && next ? `Classificados para a ${next}` : "Classificação";

  return { label, concludedFase, statuses };
}
