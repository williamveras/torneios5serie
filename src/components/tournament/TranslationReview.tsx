import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { standardScheduleNote } from "@/lib/standardScheduleNote";

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
export default function TranslationReview({ tournamentId, kind = "rules", sourceId, sourceText }: { tournamentId: string; kind?: "rules" | "note"; sourceId?: string; sourceText?: string }) {
  const [language, setLanguage] = useState("en");
  const { data, isLoading, error } = useQuery<Row[]>({ queryKey: ["translation-review", tournamentId], queryFn: async () => {
    const { data, error } = await (supabase as any).rpc("get_translation_review", { tid: tournamentId });
    if (error) throw error;
    return data || [];
  }, refetchInterval: 15000 });
  const rows = data?.filter(row => row.kind === kind && row.language === language
    && (kind === "rules" ? row.source_id === tournamentId : row.source_id === sourceId && !standardScheduleNote(row.source_text))
    && (sourceText === undefined || row.source_text === sourceText));
  return <div className="space-y-4 border-t pt-6">
    <h3 className="text-lg font-semibold">{kind === "rules" ? "Traduções do regulamento" : "Tradução da observação deste confronto"}</h3>
    <p className="text-sm text-muted-foreground">{kind === "rules" ? "Ao salvar o regulamento, o sistema traduz na VPS. Revise principalmente pontuações, critérios e prazos." : "Ao salvar a observação deste confronto, o sistema traduz na VPS."} Alterar o original invalida as traduções anteriores, incluindo revisões.</p>
    <label className="flex gap-2 items-center">Idioma<select className="border rounded p-2 bg-background" value={language} onChange={e => setLanguage(e.target.value)}><option value="en">Inglês</option><option value="es">Espanhol</option><option value="fr">Francês</option></select></label>
    {isLoading && <p>Carregando traduções...</p>}{error && <p role="alert">Não foi possível carregar as traduções.</p>}
    {rows?.length === 0 && <p>{kind === "rules" ? "Salve um regulamento para iniciar as traduções." : "Nenhuma tradução disponível para a observação atual. Se acabou de salvar, aguarde a atualização."}</p>}
    {rows?.map(row => <Editor key={`${row.kind}-${row.source_id}-${row.language}-${row.source_hash}`} row={row} />)}
  </div>;
}

export function ScheduleTranslationReview({ tournamentId, items }: { tournamentId: string; items: { id: string; label: string; source: string | null }[] }) {
  const [selectedId, setSelectedId] = useState("");
  const eligible = items.filter(item => item.source?.trim() && !standardScheduleNote(item.source));
  const selected = eligible.find(item => item.id === selectedId);
  if (!eligible.length) return null;
  return <details className="rounded border p-4 space-y-4">
    <summary className="cursor-pointer font-semibold">Revisar traduções das observações dos confrontos</summary>
    <label className="block">Confronto<select className="block w-full rounded border bg-background p-2" value={selected?.id || ""} onChange={e => setSelectedId(e.target.value)}>
      <option value="">Selecione um confronto</option>
      {eligible.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
    </select></label>
    {selected && <div key={selected.id}><p className="font-medium">{selected.label}</p><TranslationReview tournamentId={tournamentId} kind="note" sourceId={selected.id} sourceText={selected.source!} /></div>}
  </details>;
}
