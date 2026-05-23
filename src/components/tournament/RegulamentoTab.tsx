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
  const [regulamento, setRegulamento] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tournaments")
      .select("regulamento")
      .eq("id", tournamentId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRegulamento((data as any)?.regulamento ?? "");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tournamentId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("tournaments")
      .update({ regulamento: regulamento || null } as any)
      .eq("id", tournamentId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Regulamento salvo!");
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
            <Textarea
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
      </CardContent>
    </Card>
  );
}
