import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trophy, Plus, Calendar, LogOut } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import TournamentPage from "./TournamentPage";
import type { Tables } from "@/integrations/supabase/types";

type Tournament = Tables<"tournaments">;

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTournaments = async () => {
    const { data } = await supabase.from("tournaments").select("*").order("data_inicio", { ascending: false });
    if (data) setTournaments(data);
  };

  useEffect(() => { fetchTournaments(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    const { error } = await supabase.from("tournaments").insert({ nome, data_inicio: dataInicio, created_by: user.id });
    if (error) {
      toast.error("Erro ao criar torneio");
    } else {
      toast.success("Torneio criado!");
      setNome("");
      setDataInicio("");
      setDialogOpen(false);
      fetchTournaments();
    }
    setLoading(false);
  };

  if (selectedTournament) {
    return <TournamentPage tournament={selectedTournament} onBack={() => { setSelectedTournament(null); fetchTournaments(); }} />;
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Gerenciador de Torneios</span>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4 mr-1" /> Sair</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Meus Torneios</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Novo Torneio</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Torneio</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do torneio</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} required placeholder="Ex: Campeonato Regional 2026" />
                </div>
                <div className="space-y-2">
                  <Label>Data de início</Label>
                  <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum torneio cadastrado ainda.</p>
              <p className="text-sm">Clique em "Novo Torneio" para começar.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {tournaments.map(t => (
              <Card key={t.id} className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]" onClick={() => setSelectedTournament(t)}>
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.nome}</p>
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
