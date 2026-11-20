import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { t, usePublicLanguage } from "@/lib/publicI18n";

export interface Translation { kind: "rules" | "note" | "rules_summary" | "result_note"; source_id: string; source_text: string; source_hash: string; text: string | null; status: string; reviewed: boolean; }
export function useTranslations(tournamentId?: string) {
  const language = usePublicLanguage();
  return useQuery<Translation[]>({
    queryKey: ["public-translations", tournamentId, language], enabled: !!tournamentId && language !== "pt",
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_tournament_translations", { tid: tournamentId, lang: language });
      if (error) throw error;
      return data || [];
    }, refetchInterval: 15000,
  });
}
export default function TranslatedText({ tournamentId, source, kind = "rules", sourceId }: { tournamentId: string; source: string; kind?: "rules" | "note" | "rules_summary" | "result_note"; sourceId?: string }) {
  const language = usePublicLanguage();
  const { data } = useTranslations(tournamentId);
  const [original, setOriginal] = useState(false);
  const row = data?.find(r => r.kind === kind && r.source_id === (sourceId || tournamentId) && r.source_text === source);
  const ready = row?.status === "ready" && !!row.text;
  return <div>
    {language !== "pt" && <div className="mb-2 text-xs text-muted-foreground" role="status">
      {ready ? t(row.reviewed ? "Tradução revisada pelo organizador." : "Tradução automática. Consulte o original em caso de dúvida.") : t("Tradução indisponível no momento. Exibindo o original em português.")}
      {ready && <button type="button" className="ml-2 underline" onClick={() => setOriginal(!original)}>{t(original ? "Ver tradução" : "Ver original em português")}</button>}
    </div>}
    <div lang={language !== "pt" && ready && !original ? language : "pt-BR"} className="whitespace-pre-wrap">{language !== "pt" && ready && !original ? row.text : source}</div>
  </div>;
}
