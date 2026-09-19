import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { OrgMembership } from "@/hooks/useOrganizations";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  org: OrgMembership;
};

type MemberRow = {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  nome: string | null;
};

export default function OrganizationMembersDialog({ open, onOpenChange, org }: Props) {
  const { user } = useAuth();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [adding, setAdding] = useState(false);

  const [invites, setInvites] = useState<Array<{id:string;email:string;role:string;status:string;sent_at:string|null;attempts:number}>>([]);
  const canManage = org.role === "owner" || org.role === "admin";

  const fetch = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("organization_members" as any)
      .select("id, user_id, role")
      .eq("organization_id", org.id);
    const rows = (data ?? []) as any[];
    const userIds = rows.map((r) => r.user_id);
    let profiles: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds);
      profiles = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.nome]));
    }
    setMembers(rows.map((r) => ({ ...r, nome: profiles[r.user_id] ?? null })));
    if (canManage) {
      const {data: invitations,error} = await (supabase as any).rpc("list_organization_invites",{org:org.id});
      if(error) toast.error("Não foi possível carregar os convites.");
      else setInvites(invitations || []);
    }
    setLoading(false);
  };

  useEffect(() => { if (open) fetch(); /* eslint-disable-next-line */ }, [open, org.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    const { error } = await (supabase as any).rpc("send_organization_invite", {
      org: org.id, recipient: email.trim(), invited_role: role,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Convite criado. O e-mail será enviado em instantes.");
      setEmail("");
      fetch();
    }
    setAdding(false);
  };

  const handleInviteAction = async (id: string, action: "resend" | "revoke") => {
    if (action === "revoke" && !confirm("Cancelar este convite?")) return;
    setAdding(true);
    const {error} = await (supabase as any).rpc("manage_organization_invite",{invitation:id,action});
    if(error) toast.error(error.message);
    else { toast.success(action === "resend" ? "Novo convite agendado; o link anterior foi cancelado." : "Convite cancelado."); await fetch(); }
    setAdding(false);
  };

  const handleChangeRole = async (id: string, newRole: "owner" | "admin" | "member") => {
    const { error } = await supabase.from("organization_members" as any).update({ role: newRole } as any).eq("id", id);
    if (error) toast.error(error.message);
    else fetch();
  };

  const handleRemove = async (id: string, userId: string) => {
    if (!confirm("Remover este membro?")) return;
    const { error } = await supabase.from("organization_members" as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Membro removido");
      fetch();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Membros — {org.nome}</DialogTitle></DialogHeader>

        {canManage && (
          <form onSubmit={handleAdd} className="space-y-3 border-b pb-4">
            <div className="space-y-1">
              <Label htmlFor="invite-email">Convidar por e-mail</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                id="invite-email" type="email" required maxLength={254}
                placeholder="pessoa@exemplo.com"
              />
              <p className="text-xs text-muted-foreground">
                O convite vale por sete dias. O destinatário precisa aceitar com uma conta aprovada e com este mesmo e-mail.
              </p>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <Label>Papel</Label>
                <Select value={role} onValueChange={(v) => setRole(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={adding}>{adding ? "Enviando..." : "Enviar convite"}</Button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum membro.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.nome ?? "(sem nome)"}</p>

                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManage && m.user_id !== user?.id ? (
                    <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v as any)}>
                      <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Owner</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Membro</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                  )}
                  {canManage && m.user_id !== user?.id && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemove(m.id, m.user_id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {canManage && invites.length > 0 && <section className="border-t pt-3 space-y-3 max-h-[30vh] overflow-y-auto">
          <h3 className="font-semibold">Convites enviados</h3>
          {invites.map(inv => <div key={inv.id} className="border rounded p-3 space-y-2">
            <p className="break-all">{inv.email}</p><p className="text-xs text-muted-foreground">{inv.role === "admin" ? "Administrador" : "Membro"} — {inv.status === "accepted" ? "Aceito" : inv.status === "revoked" ? "Cancelado" : inv.status === "expired" ? "Expirado" : inv.sent_at ? "Aguardando aceite" : inv.attempts >= 10 ? "Falha no envio; tente reenviar" : "Envio agendado"}</p>
            {(inv.status === "pending" || inv.status === "expired") && <div className="flex gap-2"><Button variant="outline" disabled={adding} onClick={() => handleInviteAction(inv.id,"resend")}>Reenviar</Button><Button variant="outline" disabled={adding} onClick={() => handleInviteAction(inv.id,"revoke")}>Cancelar convite</Button></div>}
          </div>)}
        </section>}
      </DialogContent>
    </Dialog>
  );
}
