import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Users, ArrowRight, Loader2, LogIn } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type TournamentLite = {
  id: string;
  nome: string;
  data_inicio: string;
  modalidade: string | null;
};

export default function Home() {
  const [tournaments, setTournaments] = useState<TournamentLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tournaments")
        .select("id, nome, data_inicio, modalidade")
        .order("data_inicio", { ascending: false });
      if (data) setTournaments(data as TournamentLite[]);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-lg truncate">Torneios Quinta Série</span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/admin"><LogIn className="h-4 w-4 mr-1" /> Área administrativa</Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        <section className="mb-10 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">Nossos Torneios</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Acompanhe classificações, resultados, agendas e chaves de todos os torneios organizados pela Quinta Série.
          </p>
        </section>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>Nenhum torneio publicado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {tournaments.map((t) => (
              <Link key={t.id} to={`/p/${t.id}`} className="block group">
                <Card className="h-full hover:shadow-md hover:border-primary/40 transition-all active:scale-[0.99]">
                  <CardContent className="py-5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium flex items-center gap-2 truncate">
                        {t.nome}
                        {t.modalidade === "duplas" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                            <Users className="h-3 w-3" /> Duplas
                          </span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(t.data_inicio + "T00:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t bg-background mt-10">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Quinta Série — Torneios
        </div>
      </footer>
    </div>
  );
}
