import TranslatedText from "@/components/public/TranslatedText";
import { t as tr, usePublicLanguage, localeCode } from "@/lib/publicI18n";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2, Users, Crown, ExternalLink } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { applySiteName } from "@/lib/siteConfig";
const HORARIO_OPTIONS = ["Manhã", "Tarde", "Noite", "Qualquer horário"] as const;
type LinkInfo = {
    tournament_id: string;
    expires_at: string;
    tournament_name?: string;
    modalidade: "individual" | "duplas";
    regulamento?: string | null;
    whatsapp_group_url?: string | null;
};
export default function PublicRegistration() {
    const language = usePublicLanguage();
    const { token } = useParams<{
        token: string;
    }>();
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
    // 1 = jogador 1 é capitão; 2 = jogador 2
    const [captain, setCaptain] = useState<1 | 2>(1);
    // Shared
    const [horarios, setHorarios] = useState<string[]>([]);
    const [comentario, setComentario] = useState("");
    // Welcome / regulamento acceptance gate
    const [acceptedRules, setAcceptedRules] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const toggleHorario = (opt: string, checked: boolean) => {
        setHorarios((prev) => (checked ? [...prev, opt] : prev.filter((h) => h !== opt)));
    };
    useEffect(() => {
        (async () => {
            if (!token) {
                setError("Link inv\u00E1lido.");
                setLoading(false);
                return;
            }
            const { data, error: err } = await (supabase as any).rpc("validate_registration_token", { _token: token });
            if (err || !data || data.length === 0) {
                setError("Link inv\u00E1lido, n\u00E3o encontrado ou expirado.");
                setLoading(false);
                return;
            }
            const row = data[0];
            setLink({
                tournament_id: row.tournament_id,
                expires_at: row.expires_at,
                tournament_name: row.tournament_name,
                modalidade: (row.modalidade as "individual" | "duplas") || "individual",
                regulamento: row.regulamento ?? null,
                whatsapp_group_url: row.whatsapp_group_url ?? null,
            });
            setLoading(false);
        })();
    }, [token]);
    useEffect(() => {
        if (!link?.tournament_name)
            return;
        document.title = tr("Inscri\u00E7\u00E3o \u2014 {0}", { "0": link.tournament_name || "" });
        return () => { applySiteName(); };
    }, [link?.tournament_name, language]);
    const isDuplas = link?.modalidade === "duplas";
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!link || !token)
            return;
        setSubmitting(true);
        let err: any = null;
        const horariosStr = horarios.join(", ") || null;
        if (isDuplas) {
            if (!teamName.trim()) {
                toast.error(tr("Informe o nome da equipe"));
                setSubmitting(false);
                return;
            }
            if (!p1Nome.trim() || !p2Nome.trim()) {
                toast.error(tr("Informe o nome completo dos dois jogadores"));
                setSubmitting(false);
                return;
            }
            if (!p1Email.trim() || !p2Email.trim()) {
                toast.error(tr("Informe o e-mail dos dois jogadores"));
                setSubmitting(false);
                return;
            }
            if (!p1Nick.trim() || !p2Nick.trim()) {
                toast.error(tr("Informe o nick no Playroom dos dois jogadores"));
                setSubmitting(false);
                return;
            }
            if (!p1Whats.trim() || !p2Whats.trim()) {
                toast.error(tr("Informe o WhatsApp dos dois jogadores"));
                setSubmitting(false);
                return;
            }
            if (horarios.length === 0) {
                toast.error(tr("Selecione ao menos uma prefer\u00EAncia de hor\u00E1rio"));
                setSubmitting(false);
                return;
            }
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
                _p1_is_captain: captain === 1,
                _p2_is_captain: captain === 2,
            });
            err = res.error;
        }
        else {
            if (!nome.trim()) {
                toast.error(tr("Informe o nome completo"));
                setSubmitting(false);
                return;
            }
            if (!email.trim()) {
                toast.error(tr("Informe o e-mail"));
                setSubmitting(false);
                return;
            }
            if (!nick.trim()) {
                toast.error(tr("Informe o nick no Playroom"));
                setSubmitting(false);
                return;
            }
            if (!whats.trim()) {
                toast.error(tr("Informe o WhatsApp"));
                setSubmitting(false);
                return;
            }
            if (horarios.length === 0) {
                toast.error(tr("Selecione ao menos uma prefer\u00EAncia de hor\u00E1rio"));
                setSubmitting(false);
                return;
            }
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
            const msg = String(err.message || "");
            if (msg.includes("max_participants_reached")) {
                toast.error(tr("Inscri\u00E7\u00F5es encerradas"), { description: tr("O limite de participantes deste torneio j\u00E1 foi atingido.") });
            }
            else if (msg.includes("duplicate_registration")) {
                toast.error(tr("Inscri\u00E7\u00E3o duplicada"), {
                    description: tr("J\u00E1 encontramos uma inscri\u00E7\u00E3o com o mesmo nome, nick ou e-mail neste torneio. Esta nova inscri\u00E7\u00E3o foi ignorada."),
                });
            }
            else if (msg.includes("team_name_taken")) {
                toast.error(tr("Nome de equipe j\u00E1 utilizado"), {
                    description: tr("J\u00E1 existe uma equipe cadastrada com esse nome neste torneio. Por favor, escolha outro nome de equipe."),
                });
            }
            else {
                toast.error(tr("Erro ao enviar inscri\u00E7\u00E3o"), { description: tr("Não foi possível enviar. Tente novamente.") });
            }
            return;
        }
        setDone(true);
    };
    if (loading) {
        return (<div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
      </div>);
    }
    if (error) {
        return (<div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-3">
            <XCircle className="h-12 w-12 text-destructive mx-auto"/>
            <h1 className="text-xl font-semibold">{tr("N\u00E3o foi poss\u00EDvel abrir o formul\u00E1rio")}</h1>
            <p className="text-muted-foreground">{tr(error || "")}</p>
          </CardContent>
        </Card>
      </div>);
    }
    if (done) {
        const publicUrl = `${window.location.origin}/p/${link?.tournament_id}`;
        return (<div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
        <Card className="max-w-md w-full">
          <CardContent className="py-10 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto"/>
            <h1 className="text-xl font-semibold">{tr("Inscri\u00E7\u00E3o enviada!")}</h1>
            <p className="text-muted-foreground">{tr("Sua inscri\u00E7\u00E3o em ")}<strong>{link?.tournament_name}</strong>{tr(" foi recebida com sucesso.")}</p>
            {link?.whatsapp_group_url && (<div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-2 text-left">
                <p>{tr("Segue link de entrada no grupo fechado do torneio no WhatsApp, onde passaremos todas as informa\u00E7\u00F5es e atualiza\u00E7\u00F5es do torneio.")}</p>
                <a href={link.whatsapp_group_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline font-medium break-all">
                  <ExternalLink className="h-4 w-4 shrink-0"/>{tr("Entrar no grupo do WhatsApp")}</a>
              </div>)}
            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline font-medium">
              <ExternalLink className="h-4 w-4"/>{tr("Acompanhar torneio")}</a>
          </CardContent>
        </Card>
      </div>);
    }
    return (<div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{tr("Inscri\u00E7\u00E3o \u2014 ")}{link?.tournament_name}
              {isDuplas && (<span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  <Users className="h-3 w-3"/>{tr(" Duplas")}</span>)}
            </CardTitle>
            <CardDescription>
              {isDuplas
            ? tr("Preencha os dados dos dois jogadores da dupla.") : tr("Preencha os dados abaixo para se inscrever no torneio.")}
              <br />
              <span className="text-xs">{tr("Inscri\u00E7\u00F5es abertas at\u00E9 ")}{new Date(link!.expires_at).toLocaleString(localeCode())}.
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showForm ? (<div className="space-y-4">
                <div className="space-y-2">
                  <h2 className="text-base font-semibold">{tr("Bem-vindo(a)!")}</h2>
                  <p className="text-sm text-muted-foreground">{tr("Que bom ter voc\u00EA aqui. Leia o regulamento abaixo, aceite marcando a caixinha e clique em continuar para ter acesso ao formul\u00E1rio.")}</p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-4 max-h-80 overflow-auto">
                  {link?.regulamento && link.regulamento.trim() ? (<div className="whitespace-pre-wrap text-sm leading-relaxed">
                      <TranslatedText tournamentId={link.tournament_id} source={link.regulamento} />
                    </div>) : (<p className="text-sm text-muted-foreground italic">{tr("O organizador ainda n\u00E3o publicou um regulamento para este torneio.")}</p>)}
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox id="accept-rules" checked={acceptedRules} onCheckedChange={(c) => setAcceptedRules(c === true)} className="mt-0.5"/>
                  <span className="text-sm">{tr("Li e aceito o regulamento")}</span>
                </label>
                <Button type="button" className="w-full" disabled={!acceptedRules} onClick={() => setShowForm(true)}>{tr("Continuar")}</Button>
              </div>) : (<form onInvalid={e => { const input = e.target as HTMLInputElement; input.setCustomValidity(tr(input.validity.typeMismatch ? "Informe um e-mail válido." : "Preencha este campo.")); }} onInput={e => { const input = e.target as HTMLInputElement; input.setCustomValidity?.(""); }} onSubmit={handleSubmit} className="space-y-4">
              {isDuplas ? (<>
                  <div className="space-y-2">
                    <Label htmlFor="teamName">{tr("Nome da equipe *")}</Label>
                    <Input id="teamName" value={teamName} onChange={(e) => setTeamName(e.target.value)} required maxLength={200}/>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold text-sm">{tr("Jogador 1")}</h3>
                    <div className="space-y-2">
                      <Label htmlFor="p1Nome">{tr("Nome completo *")}</Label>
                      <Input id="p1Nome" value={p1Nome} onChange={(e) => setP1Nome(e.target.value)} required maxLength={200}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Nick">{tr("Nick no Playroom *")}</Label>
                      <Input id="p1Nick" value={p1Nick} onChange={(e) => setP1Nick(e.target.value)} required maxLength={100}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Email">{tr("E-mail *")}</Label>
                      <Input id="p1Email" type="email" value={p1Email} onChange={(e) => setP1Email(e.target.value)} required maxLength={200}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p1Whats">{tr("WhatsApp *")}</Label>
                      <Input id="p1Whats" value={p1Whats} onChange={(e) => setP1Whats(e.target.value)} required maxLength={50}/>
                    </div>
                    <Button type="button" size="sm" variant={captain === 1 ? "default" : "outline"} onClick={() => setCaptain(1)} className="w-full">
                      <Crown className="h-3.5 w-3.5 mr-1"/>
                      {captain === 1 ? tr("Capit\u00E3o da equipe") : tr("Definir como capit\u00E3o")}
                    </Button>
                  </div>

                  <div className="rounded-lg border p-4 space-y-3">
                    <h3 className="font-semibold text-sm">{tr("Jogador 2")}</h3>
                    <div className="space-y-2">
                      <Label htmlFor="p2Nome">{tr("Nome completo *")}</Label>
                      <Input id="p2Nome" value={p2Nome} onChange={(e) => setP2Nome(e.target.value)} required maxLength={200}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Nick">{tr("Nick no Playroom *")}</Label>
                      <Input id="p2Nick" value={p2Nick} onChange={(e) => setP2Nick(e.target.value)} required maxLength={100}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Email">{tr("E-mail *")}</Label>
                      <Input id="p2Email" type="email" value={p2Email} onChange={(e) => setP2Email(e.target.value)} required maxLength={200}/>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="p2Whats">{tr("WhatsApp *")}</Label>
                      <Input id="p2Whats" value={p2Whats} onChange={(e) => setP2Whats(e.target.value)} required maxLength={50}/>
                    </div>
                    <Button type="button" size="sm" variant={captain === 2 ? "default" : "outline"} onClick={() => setCaptain(2)} className="w-full">
                      <Crown className="h-3.5 w-3.5 mr-1"/>
                      {captain === 2 ? tr("Capit\u00E3o da equipe") : tr("Definir como capit\u00E3o")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{tr("O capit\u00E3o ser\u00E1 a pessoa de contato da dupla em caso de necessidade.")}</p>
                </>) : (<>
                  <div className="space-y-2">
                    <Label htmlFor="nome">{tr("Nome completo *")}</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200}/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nick">{tr("Nick no Playroom *")}</Label>
                    <Input id="nick" value={nick} onChange={(e) => setNick(e.target.value)} required maxLength={100}/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">{tr("E-mail *")}</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={200}/>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whats">{tr("WhatsApp *")}</Label>
                    <Input id="whats" value={whats} onChange={(e) => setWhats(e.target.value)} required maxLength={50}/>
                  </div>
                </>)}

              <div className="space-y-2">
                <Label>{tr("Prefer\u00EAncia de hor\u00E1rios *")}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {HORARIO_OPTIONS.map((opt) => {
                const id = `horario-${opt}`;
                const checked = horarios.includes(opt);
                return (<label key={opt} htmlFor={id} className="flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50">
                        <Checkbox id={id} checked={checked} onCheckedChange={(c) => toggleHorario(opt, c === true)}/>
                        <span className="text-sm">{tr(opt)}</span>
                      </label>);
            })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="comentario">{tr("Coment\u00E1rio (opcional)")}</Label>
                <Textarea id="comentario" value={comentario} onChange={(e) => setComentario(e.target.value)} maxLength={500}/>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? tr("Enviando...") : isDuplas ? tr("Enviar inscri\u00E7\u00E3o da dupla") : tr("Enviar inscri\u00E7\u00E3o")}
              </Button>
            </form>)}
          </CardContent>
        </Card>
      </div>
    </div>);
}
