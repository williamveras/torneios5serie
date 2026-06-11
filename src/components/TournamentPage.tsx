import { useState } from "react";
import { ArrowLeft, Share2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import PlayersTab from "./tournament/PlayersTab";
import MatchupsTab from "./tournament/MatchupsTab";
import ResultsTab from "./tournament/ResultsTab";
import ScheduleTab from "./tournament/ScheduleTab";
import StandingsTab from "./tournament/StandingsTab";
import StatsTab from "./tournament/StatsTab";
import RegulamentoTab from "./tournament/RegulamentoTab";
import RegistrationLinkTab from "./tournament/RegistrationLinkTab";
import TournamentSettingsDialog from "./tournament/TournamentSettingsDialog";
import { useStandingsTabLabel } from "@/hooks/useStandingsTabLabel";

type Tournament = Tables<"tournaments">;

interface Props {
  tournament: Tournament;
  onBack: () => void;
}

export default function TournamentPage({ tournament, onBack }: Props) {
  const [activeTab, setActiveTab] = useState("players");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { label: standingsLabel } = useStandingsTabLabel(tournament.id);
  const [prefillPlayerId, setPrefillPlayerId] = useState<string | null>(null);
  const [prefillPlayer2Id, setPrefillPlayer2Id] = useState<string | null>(null);
  const [prefillGrupo, setPrefillGrupo] = useState<string | null>(null);

  const handleScheduleForPlayer = (playerId: string) => {
    setPrefillPlayerId(playerId);
    setPrefillPlayer2Id(null);
    setPrefillGrupo(null);
    setActiveTab("schedule");
  };

  const handleScheduleMatchup = (player1Id: string, player2Id: string, grupo: string) => {
    setPrefillPlayerId(player1Id);
    setPrefillPlayer2Id(player2Id);
    setPrefillGrupo(grupo);
    setActiveTab("schedule");
  };

  const consumePrefill = () => {
    setPrefillPlayerId(null);
    setPrefillPlayer2Id(null);
    setPrefillGrupo(null);
  };

  const handleSharePublicLink = async () => {
    const url = `https://torneios5serie.lovable.app/p/${tournament.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link público copiado!", { description: url });
    } catch {
      toast.error("Não foi possível copiar", { description: url });
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold leading-tight truncate">{tournament.nome}</h1>
          </div>
          <Button variant="outline" size="sm" onClick={handleSharePublicLink}>
            <Share2 className="h-4 w-4 mr-1" /> Compartilhar link público
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSettingsOpen(true)} title="Configurações">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <TournamentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        tournamentId={tournament.id}
      />

      <main className="max-w-5xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            <TabsTrigger value="players">Participantes</TabsTrigger>
            <TabsTrigger value="matchups">Confrontos</TabsTrigger>
            <TabsTrigger value="results">Registrar Resultados</TabsTrigger>
            <TabsTrigger value="schedule">Agenda</TabsTrigger>
            <TabsTrigger value="standings">{standingsLabel}</TabsTrigger>
            <TabsTrigger value="stats">Estatísticas</TabsTrigger>
            <TabsTrigger value="regulamento">Regulamento</TabsTrigger>
            <TabsTrigger value="inscricoes">Inscrições</TabsTrigger>
          </TabsList>

          <TabsContent value="players">
            <PlayersTab tournamentId={tournament.id} onScheduleMatch={handleScheduleForPlayer} />
          </TabsContent>
          <TabsContent value="matchups">
            <MatchupsTab tournamentId={tournament.id} onScheduleMatchup={handleScheduleMatchup} />
          </TabsContent>
          <TabsContent value="results">
            <ResultsTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="schedule">
            <ScheduleTab
              tournamentId={tournament.id}
              prefillPlayerId={prefillPlayerId}
              prefillPlayer2Id={prefillPlayer2Id}
              prefillGrupo={prefillGrupo}
              onPrefillConsumed={consumePrefill}
            />
          </TabsContent>
          <TabsContent value="standings">
            <StandingsTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="stats">
            <StatsTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="regulamento">
            <RegulamentoTab tournamentId={tournament.id} />
          </TabsContent>
          <TabsContent value="inscricoes">
            <RegistrationLinkTab tournamentId={tournament.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
