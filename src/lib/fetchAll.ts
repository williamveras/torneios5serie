import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

/**
 * Fetches all match_results rows for a tournament, paginating around the
 * 1000-row Supabase default limit. Returns a single concatenated array.
 */
export async function fetchAllMatchResults(tournamentId: string) {
  const all: any[] = [];
  let from = 0;
  // Safety cap: 50k rows
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabase
      .from("match_results")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}
