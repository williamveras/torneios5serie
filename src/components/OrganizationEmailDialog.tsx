import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { OrgMembership } from "@/hooks/useOrganizations";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  org: OrgMembership;
};

export default function OrganizationEmailDialog({ open, onOpenChange, org }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [secretName, setSecretName] = useState("");

  const canManage = org.role === "owner" || org.role === "admin";

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("organizations" as any)
        .select("email_from_name, email_from_email, public_base_url, resend_secret_name")
        .eq("id", org.id)
        .maybeSingle();
      const o = (data ?? {}) as any;
      setFromName(o.email_from_name ?? "");
      setFromEmail(o.email_from_email ?? "");
      setBaseUrl(o.public_base_url ?? "");
      setSecretName(o.resend_secret_name ?? "");
      setLoading(false);
    })();
  }, [open, org.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("organizations" as any)
      .update({
        email_from_name: fromName.trim() || null,
        email_from_email: fromEmail.trim() || null,
        public_base_url: baseUrl.trim().replace(/\/+$/, "") || null,
        resend_secret_name: secretName.trim() || null,
      } as any)
      .eq("id", org.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Configurações de e-mail salvas");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurações de e-mail — {org.nome}</DialogTitle>
          <DialogDescription>
            Define como os e-mails desta organização chegam aos participantes (remetente, site e chave de envio).
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-from-name">Nome do remetente</Label>
              <Input
                id="org-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Ex: Torneios Amizade Vip"
                disabled={!canManage}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-from-email">E-mail de envio</Label>
              <Input
                id="org-from-email"
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="Ex: comunicacoes@amizadevip.com.br"
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                O domínio deste e-mail precisa estar verificado no serviço de envio.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-base-url">Endereço do site da organização</Label>
              <Input
                id="org-base-url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="Ex: https://amizadevip.com.br"
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Usado nos links dos torneios dentro dos e-mails.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="org-secret">Nome da chave de envio</Label>
              <Input
                id="org-secret"
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                placeholder="Ex: RESEND_API_KEY_AMIZADEVIP"
                disabled={!canManage}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para usar a chave padrão. Peça para cadastrarmos a chave dessa organização antes de informar o nome aqui.
              </p>
            </div>
            {canManage && (
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
