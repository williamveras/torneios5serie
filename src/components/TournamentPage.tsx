import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Tables } from "@/integrations/supabase/types";
import PlayersTab from "./tournament/PlayersTab";
import ResultsTab from "./tournament/ResultsTab";
import StandingsTab from "./tournament/StandingsTab";

type Tournament = Tables<"tournaments">;

interface Props {
  tournament: Tournament;
  onBack: () => void;
}

export default function TournamentPage({ tournament, onBack }: Props) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="font-semibold leading-tight">{tournament.nome}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs defaultValue="players">
          <TabsList className="mb-4">
            <TabsTrigger value="players">Participantes</TabsTrigger>
            <TabsTrigger value="results">Registrar Resultados</TabsTrigger>
            <TabsTrigger value="standings">Classificação</TabsTrigger>
          </TabsList>

          <TabsContent value="players">
            <PlayersTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="results">
            <ResultsTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab tournamentId={tournament.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
