import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link2, Copy, Trash2, Plus } from "lucide-react";

interface Props {
  tournamentId: string;
}

type RegLink = {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
};

function genToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function buildUrl(token: string) {
  return `https://torneios5serie.lovable.app/inscricao/${token}`;
}

export default function RegistrationLinkTab({ tournamentId }: Props) {
  const [links, setLinks] = useState<RegLink[]>([]);
  const [open, setOpen] = useState(false);
  const [expiresDate, setExpiresDate] = useState("");
  const [expiresTime, setExpiresTime] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchLinks = async () => {
    const { data } = await supabase
      .from("registration_links")
      .select("id, token, expires_at, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: false });
    if (data) setLinks(data);
  };

  useEffect(() => { fetchLinks(); }, [tournamentId]);

  const handleCreate = async () => {
    if (!expiresDate) {
      toast.error("Informe a data de expiração");
      return;
    }
    setCreating(true);
    // se horário informado, usa ele; senão, 23:59:59 do dia escolhido (local)
    const timePart = expiresTime ? `${expiresTime}:00` : "23:59:59";
    const expiresAt = new Date(`${expiresDate}T${timePart}`);
    const token = genToken();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("registration_links").insert({
      tournament_id: tournamentId,
      token,
      expires_at: expiresAt.toISOString(),
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) {
      toast.error("Erro ao gerar link", { description: error.message });
      return;
    }
    setOpen(false);
    setExpiresDate("");
    setExpiresTime("");
    toast.success("Link de inscrição gerado!");
    fetchLinks();
  };

  const copyLink = async (token: string) => {
    const url = buildUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!", { description: url });
    } catch {
      toast.error("Não foi possível copiar", { description: url });
    }
  };

  const removeLink = async (id: string) => {
    if (!confirm("Excluir este link de inscrição?")) return;
    const { error } = await supabase.from("registration_links").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Link removido");
    fetchLinks();
  };

  const isActive = (l: RegLink) => new Date(l.expires_at) > new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Links de inscrição</h2>
          <p className="text-sm text-muted-foreground">
            Gere um link público para que participantes se inscrevam neste torneio.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Gerar link
        </Button>
      </div>

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nenhum link gerado ainda.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((l) => {
            const active = isActive(l);
            const url = buildUrl(l.token);
            return (
              <Card key={l.id}>
                <CardContent className="py-3 flex items-center gap-3 flex-wrap">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-mono truncate">{url}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Expira em {new Date(l.expires_at).toLocaleString("pt-BR")}
                    </div>
                  </div>
                  <Badge variant={active ? "default" : "secondary"}>
                    {active ? "Ativo" : "Expirado"}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => copyLink(l.token)}>
                    <Copy className="h-4 w-4 mr-1" /> Copiar
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => removeLink(l.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar link de inscrição</DialogTitle>
            <DialogDescription>
              Escolha até quando o link ficará ativo. Após essa data, o formulário será fechado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="expires">Válido até</Label>
            <Input
              id="expires"
              type="date"
              value={expiresDate}
              onChange={(e) => setExpiresDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
            <p className="text-xs text-muted-foreground">
              O link expirará às 23:59 do dia escolhido.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Gerando..." : "Gerar link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
