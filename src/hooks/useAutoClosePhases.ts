import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { FASES } from "@/lib/constants";
import { toast } from "sonner";

/**
 * Encerra automaticamente qualquer fase eliminatória (incluindo "Repescagem")
 * assim que todos os confrontos daquela fase tiverem resultado registrado
 * para os dois lados. Roda no nível da página do torneio — não depende da aba
 * "Classificação" estar aberta — e reage a novos resultados em tempo real.
 */
export function useAutoClosePhases(tournamentId: string) {
  useEffect(() => {
    let cancelled = false;

    async function run() {
      const [results, { data: matchups }, { data: statuses }] = await Promise.all([
        fetchAllMatchResults(tournamentId),
        supabase.from("matchups").select("id,fase,player1_id,player2_id").eq("tournament_id", tournamentId),
        supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
      ]);
      if (cancelled || !matchups || matchups.length === 0) return;

      const elimFases = FASES.filter(f => f !== "Fase de Grupos");
      for (const fase of elimFases) {
        const status = (statuses || []).find(s => s.fase === fase)?.status;
        if (status === "concluida") continue;
        const faseMatchups = matchups.filter(m => (m.fase || "Fase de Grupos") === fase);
        if (faseMatchups.length === 0) continue;
        const withResult = new Set(
          (results || [])
            .filter(r => (r.fase || "Fase de Grupos") === fase)
            .map(r => r.player_id),
        );
        const allDone = faseMatchups.every(
          m => withResult.has(m.player1_id) && withResult.has(m.player2_id),
        );
        if (!allDone) continue;

        const existing = (statuses || []).find(s => s.fase === fase);
        const { error } = existing
          ? await supabase.from("phase_status").update({ status: "concluida" }).eq("id", existing.id)
          : await supabase.from("phase_status").insert({
              tournament_id: tournamentId, fase, status: "concluida",
            });
        if (cancelled) return;
        if (error) {
          toast.error(`Não foi possível encerrar ${fase} automaticamente`, { description: error.message });
          return;
        }
        toast.success(`${fase} encerrada automaticamente — todos os confrontos concluídos.`);
        return;
      }
    }

    run();
    const channel = supabase
      .channel(`auto_close_${tournamentId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `tournament_id=eq.${tournamentId}` }, run)
      .on("postgres_changes", { event: "*", schema: "public", table: "matchups", filter: `tournament_id=eq.${tournamentId}` }, run)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [tournamentId]);
}
