import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { t, usePublicLanguage } from "@/lib/publicI18n";
import { sponsorLabels, sponsorWebsite, type Sponsor } from "@/lib/sponsors";

export function SponsorBanner({ sponsors }: { sponsors: Sponsor[] }) {
  usePublicLanguage();
  const visible = sponsors.filter(s => s.enabled);
  if (!visible.length) return null;
  return <aside aria-label={t("Patrocínios")} className="mb-4 rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-900 dark:text-amber-200 space-y-1">
    {visible.map(s => {
      let href: string | null = null;
      try { href = sponsorWebsite(s.website || ""); } catch { /* Display the name even if an old URL is invalid. */ }
      return <p key={s.id} className="break-words">{t(sponsorLabels[s.category] || "Patrocínio")}: {href ? <a href={href} target="_blank" rel="noopener noreferrer sponsored" className="underline">{s.name}</a> : s.name}</p>;
    })}
  </aside>;
}

export default function PublicSponsors({ tournamentId }: { tournamentId: string }) {
  const { data = [] } = useQuery({ queryKey: ["public-sponsors", tournamentId], queryFn: async () => {
    const { data, error } = await supabase.from("tournament_sponsors").select("*").eq("tournament_id", tournamentId).eq("enabled", true).order("position").order("id");
    if (error) throw error;
    return data as Sponsor[];
  }, refetchInterval: 30000 });
  return <SponsorBanner sponsors={data} />;
}
