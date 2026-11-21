import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sponsorLabels, sponsorWebsite, type Sponsor } from "@/lib/sponsors";
import { SponsorBanner } from "@/components/public/PublicSponsors";
import { toast } from "sonner";

function SponsorEditor({ tournamentId, sponsor, position, onSaved }: { tournamentId: string; sponsor?: Sponsor; position: number; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(sponsor?.name || "");
  const [category, setCategory] = useState(sponsor?.category || "sponsor");
  const [website, setWebsite] = useState(sponsor?.website || "");
  const [enabled, setEnabled] = useState(sponsor?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { toast.error("Informe o nome do patrocinador."); return; }
    setBusy(true);
    try {
      const values = { tournament_id: tournamentId, name: name.trim(), category, website: sponsorWebsite(website), enabled, position };
      const query = sponsor ? supabase.from("tournament_sponsors").update(values).eq("id", sponsor.id).eq("tournament_id", tournamentId) : supabase.from("tournament_sponsors").insert(values);
      const { error } = await query.select("id").single();
      if (error) throw error;
      await onSaved();
      if (!sponsor) { setName(""); setWebsite(""); setCategory("sponsor"); setEnabled(true); }
      toast.success("Patrocínio salvo.");
    } catch (error: any) { toast.error(error.message || "Não foi possível salvar."); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!sponsor || !window.confirm(`Remover o patrocínio de ${sponsor.name} deste torneio?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("tournament_sponsors").delete().eq("id", sponsor.id).eq("tournament_id", tournamentId).select("id").single();
      if (error) throw error;
      await onSaved(); toast.success("Patrocínio removido.");
    } catch (error: any) { toast.error(error.message || "Não foi possível remover."); }
    finally { setBusy(false); }
  };
  return <form onSubmit={save} className="rounded border p-4 space-y-3">
    <fieldset disabled={busy} className="space-y-3">
      <legend className="font-semibold">{sponsor ? sponsor.name : "Adicionar patrocinador"}</legend>
      <label className="block">Nome<Input required maxLength={150} value={name} onChange={e => setName(e.target.value)} /></label>
      <label className="block">Tipo<select className="block w-full rounded border bg-background p-2" value={category} onChange={e => setCategory(e.target.value)}>{Object.entries(sponsorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block">Site ou link (opcional)<Input type="url" maxLength={2048} placeholder="https://" value={website} onChange={e => setWebsite(e.target.value)} /></label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />Exibir na página pública</label>
      <div className="flex gap-2"><Button type="submit">{busy ? "Salvando..." : sponsor ? "Salvar alterações" : "Adicionar"}</Button>{sponsor && <Button type="button" variant="outline" onClick={remove}>Remover</Button>}</div>
    </fieldset>
  </form>;
}

export default function SponsorsTab({ tournamentId }: { tournamentId: string }) {
  const client = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["sponsors", tournamentId], queryFn: async () => {
    const { data, error } = await supabase.from("tournament_sponsors").select("*").eq("tournament_id", tournamentId).order("position").order("id");
    if (error) throw error;
    return data as Sponsor[];
  } });
  const saved = async () => { await client.invalidateQueries({ queryKey: ["sponsors", tournamentId] }); await client.invalidateQueries({ queryKey: ["public-sponsors", tournamentId] }); };
  return <Card><CardHeader><CardTitle>Patrocínios</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">Os patrocinadores cadastrados aqui aparecem somente na página pública deste torneio. Você pode editar, ocultar ou remover cada um.</p>
    {isLoading ? <p>Carregando...</p> : error ? <div role="alert">Não foi possível carregar os patrocínios. <Button variant="outline" onClick={() => refetch()}>Tentar novamente</Button></div> : <>
      {!!data?.some(s => s.enabled) && <div><h3 className="font-medium mb-2">Prévia dos patrocínios salvos</h3><SponsorBanner sponsors={data} /></div>}
      {data?.map(s => <SponsorEditor key={`${s.id}-${s.name}-${s.category}-${s.website}-${s.enabled}`} tournamentId={tournamentId} sponsor={s} position={s.position} onSaved={saved} />)}
      <SponsorEditor key={tournamentId} tournamentId={tournamentId} position={Math.max(0, ...(data || []).map(s => s.position)) + 1} onSaved={saved} />
    </>}
  </CardContent></Card>;
}
