import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Users } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const HORARIO_OPTIONS = ["Manhã", "Tarde", "Noite", "Qualquer horário"] as const;

type LinkInfo = {
  tournament_id: string;
  expires_at: string;
  tournament_name?: string;
  modalidade: "individual" | "duplas";
};

export default function PublicRegistration() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [link, setLink] = useState<LinkInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Individual fields
  const [nome, setNome] = useState("");
  const [nick, setNick] = useState("");
  const [email, setEmail] = useState("");
  const [whats, setWhats] = useState("");

  // Team fields
  const [teamName, setTeamName] = useState("");
  const [p1Nome, setP1Nome] = useState("");
  const [p1Nick, setP1Nick] = useState("");
  const [p1Email, setP1Email] = useState("");
  const [p1Whats, setP1Whats] = useState("");
  const [p2Nome, setP2Nome] = useState("");
  const [p2Nick, setP2Nick] = useState("");
  const [p2Email, setP2Email] = useState("");
  const [p2Whats, setP2Whats] = useState("");

  // Shared
  const [horarios, setHorarios] = useState<string[]>([]);
  const [comentario, setComentario] = useState("");

  const toggleHorario = (opt: string, checked: boolean) => {
    setHorarios((prev) => (checked ? [...prev, opt] : prev.filter((h) => h !== opt)));
  };

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
        modalidade: (row.modalidade as "individual" | "duplas") || "individual",
      });
      setLoading(false);
    })();
  }, [token]);

  const isDuplas = link?.modalidade === "duplas";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link || !token) return;

    setSubmitting(true);
    let err: any = null;
    const horariosStr = horarios.join(", ") || null;

    if (isDuplas) {
      if (!p1Nome.trim() || !p2Nome.trim()) { toast.error("Informe o nome completo dos dois jogadores"); setSubmitting(false); return; }
      if (!p1Email.trim() || !p2Email.trim()) { toast.error("Informe o e-mail dos dois jogadores"); setSubmitting(false); return; }
      const res = await (supabase as any).rpc("register_team_via_token", {
        _token: token,
        _team_name: teamName.trim() || null,
        _p1_nome: p1Nome.trim(),
        _p1_nick: p1Nick.trim() || null,
        _p1_email: p1Email.trim(),
        _p1_whatsapp: p1Whats.trim() || null,
        _p2_nome: p2Nome.trim(),
        _p2_nick: p2Nick.trim() || null,
        _p2_email: p2Email.trim(),
        _p2_whatsapp: p2Whats.trim() || null,
        _preferencia_horarios: horariosStr,
        _comentario: comentario.trim() || null,
      });
      err = res.error;
    } else {
      if (!nome.trim()) { toast.error("Informe o nome completo"); setSubmitting(false); return; }
      if (!email.trim()) { toast.error("Informe o e-mail"); setSubmitting(false); return; }
      const res = await (supabase as any).rpc("register_player_via_token", {
        _token: token,
        _nome_completo: nome.trim(),
        _nick_playroom: nick.trim() || null,
        _email: email.trim(),
        _whatsapp: whats.trim() || null,
        _preferencia_horarios: horariosStr,
        _comentario: comentario.trim() || null,
      });
      err = res.error;
    }

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
            <CardTitle className="flex items-center gap-2">
              Inscrição — {link?.tournament_name}
              {isDuplas && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <Users className="h-3 w-3" /> Duplas
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {isDuplas
                ? "Preencha os dados dos dois jogadores da dupla."
                : "Preencha os dados abaixo para se inscrever no torneio."}
              <br />
              <span className="text-xs">
                Inscrições abertas até {new Date(link!.expires_at).toLocaleString("pt-BR")}.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isDuplas ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="teamName">Nome da dupla (opcional)</Label>
                    <Input
                      id="teamName"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      maxLength={200}
                      placeholder="Se vazio, usa 'Jogador 1 / Jogador 2'"
                    />
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Jogador 1</h3>
                    <div className="space-y-2">
                      <Label htmlFor="p1Nome">Nome completo *</Label>
                      <Input id="p1Nome" value={p1Nome} onChange={(e) => setP1Nome(e.target.value)} required maxLength={200} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Nick">Nick no Playroom</Label>
                      <Input id="p1Nick" value={p1Nick} onChange={(e) => setP1Nick(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Email">E-mail *</Label>
                      <Input id="p1Email" type="email" value={p1Email} onChange={(e) => setP1Email(e.target.value)} required maxLength={200} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Whats">WhatsApp</Label>
                      <Input id="p1Whats" value={p1Whats} onChange={(e) => setP1Whats(e.target.value)} maxLength={50} />
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold text-sm">Jogador 2</h3>
                    <div className="space-y-2">
                      <Label htmlFor="p2Nome">Nome completo *</Label>
                      <Input id="p2Nome" value={p2Nome} onChange={(e) => setP2Nome(e.target.value)} required maxLength={200} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Nick">Nick no Playroom</Label>
                      <Input id="p2Nick" value={p2Nick} onChange={(e) => setP2Nick(e.target.value)} maxLength={100} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Email">E-mail *</Label>
                      <Input id="p2Email" type="email" value={p2Email} onChange={(e) => setP2Email(e.target.value)} required maxLength={200} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Whats">WhatsApp</Label>
                      <Input id="p2Whats" value={p2Whats} onChange={(e) => setP2Whats(e.target.value)} maxLength={50} />
                    </div>
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="horarios">Preferência de horários</Label>
                <Input id="horarios" value={horarios} onChange={(e) => setHorarios(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comentario">Comentário</Label>
                <Textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500} />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Enviando..." : isDuplas ? "Enviar inscrição da dupla" : "Enviar inscrição"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
