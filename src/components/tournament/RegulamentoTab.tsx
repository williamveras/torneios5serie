import TranslationReview from "./TranslationReview";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

interface Props {
  tournamentId: string;
}

export default function RegulamentoTab({ tournamentId }: Props) {
  const client = useQueryClient();
  const [resumo, setResumo] = useState("");
  const [regulamento, setRegulamento] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tournaments")
      .select("regulamento, regulamento_resumo")
      .eq("id", tournamentId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRegulamento((data as any)?.regulamento ?? "");
        setResumo(data?.regulamento_resumo ?? "");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tournamentId]);

  const handleSave = async () => {
    if (resumo.trim() && !regulamento.trim()) { toast.error("Preencha também o regulamento completo."); return; }
    setSaving(true);
    const { error } = await supabase
      .from("tournaments")
      .update({ regulamento: regulamento || null, regulamento_resumo: resumo.trim() ? resumo : null } as any)
      .eq("id", tournamentId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Regulamento salvo!");
      client.invalidateQueries({ queryKey: ["translation-review", tournamentId] });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regulamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <label className="block font-medium" htmlFor="rules-summary">Resumo do regulamento (opcional)</label>
            <Textarea id="rules-summary" value={resumo} onChange={e => setResumo(e.target.value)} className="min-h-32" placeholder="Cole aqui o resumo do regulamento..." />
            <p className="text-sm text-muted-foreground">Quando preenchido, será mostrado primeiro na página pública e na inscrição, com um link para o regulamento completo.</p>
            <label className="block font-medium" htmlFor="full-rules">Regulamento completo</label>
            <Textarea id="full-rules"
              value={regulamento}
              onChange={(e) => setRegulamento(e.target.value)}
              placeholder="Cole aqui o regulamento do torneio..."
              className="min-h-[400px] font-mono text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar regulamento
              </Button>
            </div>
          </>
        )}
        <TranslationReview tournamentId={tournamentId} />
      </CardContent>
    </Card>
  );
}
