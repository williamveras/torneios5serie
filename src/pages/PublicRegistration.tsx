import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type LinkInfo = {
  tournament_id: string;
  expires_at: string;
  tournament_name?: string;
};

export default function PublicRegistration() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const [nome, setNome] = useState("");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [whats, setWhats] = useState("");
  const [horarios, setHorarios] = useState("");
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    (async () => {
      if (!token) { setError("Link inválido."); setLoading(false); return; }
      const { data, error: err } = await (supabase as any).rpc("validate_registration_token", { _token: token });
      if (err || !data || data.length === 0) {
        setError("Link inválido, não encontrado ou expirado.");
        setLoading(false);
        return;
      }
      const row = data[0];
      setLink({
        tournament_id: row.tournament_id,
        expires_at: row.expires_at,
        tournament_name: row.tournament_name,
      });
      setLoading(false);
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || !token) return;
    if (!nome.trim()) { toast.error("Informe o nome completo"); return; }
    if (!email.trim()) { toast.error("Informe o e-mail"); return; }
    setSubmitting(true);
    const { error: err } = await (supabase as any).rpc("register_player_via_token", {
      _token: token,
      _nome_completo: nome.trim(),
      _nick_playroom: nick.trim() || null,
      _email: email.trim(),
      _whatsapp: whats.trim() || null,
      _preferencia_horarios: horarios.trim() || null,
      _comentario: comentario.trim() || null,
    });
    setSubmitting(false);
    if (err) {
      toast.error("Erro ao enviar inscrição", { description: err.message });
      return;
    }
    setDone(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold">Não foi possível abrir o formulário</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <h1 className="text-xl font-semibold">Inscrição enviada!</h1>
            <p className="text-muted-foreground">
              Sua inscrição em <strong>{link?.tournament_name}</strong> foi recebida com sucesso.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Inscrição — {link?.tournament_name}</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para se inscrever no torneio.
              <br />
              <span className="text-xs">
                Inscrições abertas até {new Date(link!.expires_at).toLocaleString("pt-BR")}.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nick">Nick no Playroom</Label>
                <Input id="nick" value={nick} onChange={(e) => setNick(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whats">WhatsApp</Label>
                <Input id="whats" value={whats} onChange={(e) => setWhats(e.target.value)} maxLength={50} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="horarios">Preferência de horários</Label>
                <Input id="horarios" value={horarios} onChange={(e) => setHorarios(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comentario">Comentário</Label>
                <Textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Enviando..." : "Enviar inscrição"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
