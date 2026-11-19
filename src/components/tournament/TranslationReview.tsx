import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Row { tournament_id: string; kind: string; source_id: string; language: string; source_text: string; source_hash: string; translated_text: string | null; status: string; reviewed: boolean; }
function Editor({ row }: { row: Row }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const action = async (regenerate: boolean) => {
    if (regenerate && !window.confirm("Gerar novamente substitui a tradução e qualquer revisão salva. Continuar?")) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc(regenerate ? "regenerate_translation" : "save_translation_review", {
        tid: row.tournament_id, field: row.kind, sid: row.source_id, lang: row.language, expected_hash: row.source_hash,
        ...(!regenerate ? { content: draft ?? row.translated_text ?? "" } : {}),
      });
      if (error) throw error;
      setDraft(null);
      await client.invalidateQueries({ queryKey: ["translation-review", row.tournament_id] });
      await client.invalidateQueries({ queryKey: ["public-translations", row.tournament_id] });
      toast.success(regenerate ? "Tradução adicionada à fila." : "Revisão salva.");
    } catch (error: any) { toast.error(error.message || "Não foi possível salvar a tradução."); }
    finally { setBusy(false); }
  };
  return <section className="space-y-3 border rounded p-4">
    <h4 className="font-semibold">{row.kind === "rules" ? "Regulamento" : "Observação de confronto"} — {row.reviewed ? "Revisada" : row.status === "ready" ? "Automática" : row.status === "failed" ? "Falha na tradução automática; você pode revisar manualmente" : "Aguardando tradução"}</h4>
    <details><summary className="cursor-pointer">Original em português</summary><p className="whitespace-pre-wrap text-sm" lang="pt-BR">{row.source_text}</p></details>
    <label className="block">Tradução<Textarea lang={row.language} className="min-h-48" value={draft ?? row.translated_text ?? ""} onChange={e => setDraft(e.target.value)} /></label>
    <div className="flex gap-2 flex-wrap"><Button disabled={busy || !(draft ?? row.translated_text ?? "").trim()} onClick={() => action(false)}>Salvar revisão</Button><Button variant="outline" disabled={busy || row.status === "pending"} onClick={() => action(true)}>Gerar novamente</Button></div>
  </section>;
}
export default function TranslationReview({ tournamentId }: { tournamentId: string }) {
  const [language, setLanguage] = useState("en");
  const { data, isLoading, error } = useQuery<Row[]>({ queryKey: ["translation-review", tournamentId], queryFn: async () => {
    const { data, error } = await (supabase as any).rpc("get_translation_review", { tid: tournamentId });
    if (error) throw error;
    return data || [];
  }, refetchInterval: 15000 });
  return <div className="space-y-4 border-t pt-6">
    <h3 className="text-lg font-semibold">Traduções públicas</h3>
    <p className="text-sm text-muted-foreground">Ao salvar o regulamento ou observações dos confrontos, o sistema traduz na VPS. Revise principalmente pontuações, critérios e prazos. Alterar o original invalida as traduções anteriores, incluindo revisões.</p>
    <label className="flex gap-2 items-center">Idioma<select className="border rounded p-2 bg-background" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option></select></label>
    {isLoading && <p>Carregando traduções...</p>}{error && <p role="alert">Não foi possível carregar as traduções.</p>}
    {data?.length === 0 && <p>Salve um regulamento ou observação para iniciar as traduções.</p>}
    {data?.filter(r => r.language === language).map(row => <Editor key={`${row.kind}-${row.source_id}-${row.language}-${row.source_hash}`} row={row} />)}
  </div>;
}
