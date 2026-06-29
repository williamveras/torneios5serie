import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildMainFases } from "@/lib/phase";

/**
 * Resolves the projected main-phase sequence for a tournament, e.g.:
 * ["Fase de Grupos", "Quartas de Final", "Semifinal", "Final"] for a small
 * bracket with 8 qualifiers. Returns null while loading or when the
 * tournament has no qualification settings yet.
 */
export function useMainFases(tournamentId: string): string[] | null {
  const [mainFases, setMainFases] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: t }, { data: groupsData }] = await Promise.all([
        supabase
          .from("tournaments")
          .select("direct_per_group,repescagem_enabled,repescagem_total")
          .eq("id", tournamentId)
          .maybeSingle(),
        supabase
          .from("players")
          .select("grupo")
          .eq("tournament_id", tournamentId)
          .not("grupo", "is", null),
      ]);
      if (cancelled) return;
      const td: any = t || {};
      const numGroups = new Set(
        ((groupsData as any[]) || [])
          .map((r) => r.grupo)
          .filter((g) => g != null && String(g).trim() !== ""),
      ).size;
      const rep = td.repescagem_enabled === false ? 0 : (td.repescagem_total ?? 0);
      const fases = buildMainFases({
        directPerGroup: td.direct_per_group ?? null,
        repescagemTotal: rep,
        numGroups,
      });
      setMainFases(fases);
    }
    load();
    const channel = supabase
      .channel(`main_fases_${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `tournament_id=eq.${tournamentId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);

  return mainFases;
}
