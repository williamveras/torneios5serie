import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { t, usePublicLanguage, localeCode } from "@/lib/publicI18n";

interface Roster {
  status: "ready" | "updating" | "review" | "unavailable";
  participants?: { team: boolean; nicks: (string | null)[] }[];
}

export default function PendingDrawRoster({ drawId }: { drawId: string }) {
  usePublicLanguage();
  const { data, isError } = useQuery<Roster>({
    queryKey: ["pending-draw-roster", drawId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_pending_draw_roster", { draw_id: drawId });
      if (error) throw error;
      return data as unknown as Roster;
    },
    refetchInterval: 30000,
    staleTime: 0,
  });
  const labels = (data?.participants || []).map(p =>
    (p.nicks.length ? p.nicks : [null]).map(nick => nick?.trim() || t("Nick não informado")).join(" / ")
  ).sort((a, b) => a.localeCompare(b, localeCode(), { sensitivity: "base", numeric: true }));
  return <section className="pt-6 text-left space-y-3" aria-label={t("Participantes do sorteio")}>
    <h2 className="text-lg font-semibold">{t("Participantes do sorteio")}</h2>
    {isError ? <p role="status">{t("Não foi possível carregar a lista. Tentaremos novamente em instantes.")}</p>
      : data?.status === "ready" ? <>
        <p className="text-sm text-muted-foreground">{t("Total de participantes: {0}", { "0": labels.length })}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {labels.map((label, index) => <li key={index} className="rounded-md border p-3 break-words">{label}</li>)}
        </ul>
      </> : <p role="status" className="text-sm text-muted-foreground">{t(data?.status === "review"
        ? "A lista deste sorteio está aguardando revisão do organizador."
        : data?.status === "unavailable" ? "Este sorteio não está mais pendente. Atualize a página para consultar o resultado."
        : "A lista de participantes está sendo atualizada. Aguarde alguns instantes.")}</p>}
  </section>;
}
