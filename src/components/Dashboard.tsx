import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizations, createOrganization } from "@/hooks/useOrganizations";
import OrganizationMembersDialog from "@/components/OrganizationMembersDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Plus, Calendar, LogOut, Users, Building2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TournamentPage from "./TournamentPage";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { orgs, activeOrg, activeOrgId, setActiveOrgId, refetch: refetchOrgs } = useOrganizations();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [numeroRodadas, setNumeroRodadas] = useState("");
  const [modalidade, setModalidade] = useState<"individual" | "duplas">("individual");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Org dialogs
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const fetchTournaments = async () => {
    if (!activeOrgId) { setTournaments([]); return; }
    const { data } = await (supabase
      .from("tournaments") as any)
      .select("*")
      .eq("organization_id", activeOrgId)
      .order("data_inicio", { ascending: false });
    if (data) setTournaments(data as any);
  };

  useEffect(() => { fetchTournaments(); /* eslint-disable-next-line */ }, [activeOrgId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeOrgId) return;
    const rodadasNum = numeroRodadas.trim() ? parseInt(numeroRodadas.trim(), 10) : null;
    if (numeroRodadas.trim() && (isNaN(rodadasNum!) || rodadasNum! < 1)) {
      toast.error("Número de rodadas inválido.");
      return;
    }
    const maxNum = maxParticipants.trim() ? parseInt(maxParticipants.trim(), 10) : null;
    if (maxParticipants.trim() && (isNaN(maxNum!) || maxNum! < 2)) {
      toast.error("Limite de participantes inválido (mínimo 2).");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("tournaments").insert({
      nome,
      data_inicio: dataInicio,
      created_by: user.id,
      numero_rodadas: rodadasNum,
      modalidade,
      organization_id: activeOrgId,
      max_participants: maxNum,
    } as any);
    if (error) {
      toast.error("Erro ao criar torneio");
    } else {
      toast.success("Torneio criado!");
      setNome("");
      setDataInicio("");
      setNumeroRodadas("");
      setModalidade("individual");
      setMaxParticipants("");
      setDialogOpen(false);
      fetchTournaments();
    }
    setLoading(false);
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newOrgName.trim()) return;
    setCreatingOrg(true);
    try {
      const id = await createOrganization(newOrgName, user.id);
      toast.success("Organização criada!");
      setNewOrgName("");
      setNewOrgOpen(false);
      await refetchOrgs();
      setActiveOrgId(id);
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar organização");
    } finally {
      setCreatingOrg(false);
    }
  };

  if (selectedTournament) {
    return <TournamentPage tournament={selectedTournament} onBack={() => { setSelectedTournament(null); fetchTournaments(); }} />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-lg truncate">Gerenciador de Torneios</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Organization selector */}
        <div className="flex flex-wrap items-end gap-2 mb-6">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Organização
            </Label>
            <Select value={activeOrgId ?? ""} onValueChange={(v) => setActiveOrgId(v)}>
              <SelectTrigger><SelectValue placeholder="Selecione uma organização" /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome} <span className="text-xs text-muted-foreground ml-1">({o.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={newOrgOpen} onOpenChange={setNewOrgOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Nova organização</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova organização</DialogTitle></DialogHeader>
              <form onSubmit={handleCreateOrg} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-nome">Nome da organização</Label>
                  <Input id="org-nome" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required placeholder="Ex: Liga Scopas BH" />
                </div>
                <Button type="submit" className="w-full" disabled={creatingOrg}>
                  {creatingOrg ? "Criando..." : "Criar"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          {activeOrg && (
            <Button variant="outline" size="sm" onClick={() => setMembersOpen(true)}>
              <UserCog className="h-4 w-4 mr-1" /> Membros
            </Button>
          )}
        </div>

        {activeOrg && (
          <OrganizationMembersDialog
            open={membersOpen}
            onOpenChange={setMembersOpen}
            org={activeOrg}
          />
        )}

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Torneios</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeOrgId}><Plus className="h-4 w-4 mr-1" /> Novo Torneio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Torneio</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="dash-nome">Nome do torneio</Label>
                  <Input id="dash-nome" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Campeonato Regional 2026" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dash-data">Data de início</Label>
                  <Input id="dash-data" type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dash-rodadas">Número de rodadas (Fase de Grupos)</Label>
                  <Input
                    id="dash-rodadas"
                    type="number"
                    min={1}
                    value={numeroRodadas}
                    onChange={e => setNumeroRodadas(e.target.value)}
                    placeholder="Ex: 7"
                  />
                  <p className="text-xs text-muted-foreground">
                    Usado para calcular automaticamente a rodada atual e o encerramento da fase.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dash-modalidade">Modalidade</Label>
                  <Select value={modalidade} onValueChange={(v) => setModalidade(v as "individual" | "duplas")}>
                    <SelectTrigger id="dash-modalidade"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual (1 vs 1)</SelectItem>
                      <SelectItem value="duplas">Duplas (2 vs 2)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Em torneios de duplas, cada "competidor" é uma dupla com 2 jogadores. Não pode ser alterado depois de cadastrar competidores.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dash-max">Limite de participantes (opcional)</Label>
                  <Input
                    id="dash-max"
                    type="number"
                    min={2}
                    value={maxParticipants}
                    onChange={e => setMaxParticipants(e.target.value)}
                    placeholder="Ex: 128"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se definido, novas inscrições serão bloqueadas ao atingir esse número. Deixe em branco para não limitar.
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {!activeOrgId ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Você ainda não pertence a nenhuma organização.</p>
              <p className="text-sm">Crie uma nova organização para começar.</p>
            </CardContent>
          </Card>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum torneio cadastrado nesta organização ainda.</p>
              <p className="text-sm">Clique em "Novo Torneio" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tournaments.map(t => (
              <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" onClick={() => setSelectedTournament(t)}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium flex items-center gap-2">
                      {t.nome}
                      {(t as any).modalidade === "duplas" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                          <Users className="h-3 w-3" /> Duplas
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {format(new Date(t.data_inicio + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <span className="text-muted-foreground">→</span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
