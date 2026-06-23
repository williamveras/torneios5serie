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
    setLoading(false);
  };

  useEffect(() => { if (open) fetch(); /* eslint-disable-next-line */ }, [open, org.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    // find user by email via profiles requires email column — we don't have it. Use auth.users via RPC? Not available.
    // Approach: look up profile.nome by email isn't possible. Use the email's user_id from auth via an edge function would be needed.
    // Simpler: look in profiles table — but profiles has no email. We need an RPC. Fallback: ask user_id.
    // For now, search profiles where nome equals input OR user_id equals UUID.
    let targetUserId: string | null = null;
    if (/^[0-9a-f-]{36}$/i.test(email.trim())) {
      targetUserId = email.trim();
    } else {
      toast.error("Cole o ID do usuário (UUID). Em breve: convite por email.");
      setAdding(false);
      return;
    }
    const { error } = await supabase
      .from("organization_members" as any)
      .insert({ organization_id: org.id, user_id: targetUserId, role } as any);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Membro adicionado");
      setEmail("");
      fetch();
    }
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
              <Label>Adicionar membro (ID do usuário)</Label>
              <Input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="UUID do usuário"
              />
              <p className="text-xs text-muted-foreground">
                Peça ao usuário o ID dele (mostrado no perfil). Convite por e-mail virá em breve.
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
              <Button type="submit" disabled={adding}>{adding ? "Adicionando..." : "Adicionar"}</Button>
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
                  <p className="text-xs text-muted-foreground truncate">{m.user_id}</p>
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

        {user && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            Seu ID de usuário: <code className="text-foreground">{user.id}</code>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
