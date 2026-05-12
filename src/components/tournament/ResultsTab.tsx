import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

const PENALIDADE_OPCOES = ["Sem penalidades", "W.O", "Eliminado por W.O", "Digitação na mesa", "Outra"] as const;

interface PlayerResult {
  player_id: string;
  pontos_jogo: string;
  pontos_mesa: string;
  penalidade_tipo: string;
  penalidade_outra: string;
}

const emptyResult = (): PlayerResult => ({
  player_id: "",
  pontos_jogo: "",
  pontos_mesa: "",
  penalidade_tipo: "Sem penalidades",
  penalidade_outra: "",
});

interface Props { tournamentId: string; }

export default function ResultsTab({ tournamentId }: Props) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [fase, setFase] = useState<string>("Fase de Grupos");
  const [grupo, setGrupo] = useState("");
  const [rodada, setRodada] = useState("");
  const [results, setResults] = useState<PlayerResult[]>([emptyResult()]);
  const [loading, setLoading] = useState(false);

  const isFaseDeGrupos = fase === "Fase de Grupos";

  useEffect(() => {
    supabase.from("players").select("*").eq("tournament_id", tournamentId).order("nome_completo")
      .then(({ data }) => { if (data) setPlayers(data); });
  }, [tournamentId]);

  const getPlayerGrupo = (playerId: string): string => {
    const player = players.find(p => p.id === playerId);
    return player?.grupo || "";
  };

  const updateResult = (idx: number, field: keyof PlayerResult, value: string) => {
    setResults(prev => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [field]: value };
      if (field === "player_id" && isFaseDeGrupos) {
        const playerGrupo = getPlayerGrupo(value);
        if (playerGrupo) setGrupo(playerGrupo);
      }
      return updated;
    }));

    if (field === "player_id" && value) {
      const player = players.find(p => p.id === value);
      const applyWO = () => {
        setResults(prev => prev.map((r, i) => i === idx ? {
          ...r,
          pontos_jogo: "0",
          pontos_mesa: "0",
          penalidade_tipo: "Eliminado por W.O",
          penalidade_outra: "",
        } : r));
        if (isFaseDeGrupos) {
          const playerGrupo = getPlayerGrupo(value);
          if (playerGrupo) setGrupo(playerGrupo);
        }
        toast.info("Jogador eliminado por W.O — campos preenchidos automaticamente");
      };

      if (player?.eliminado) {
        applyWO();
        return;
      }

      // Verifica se o jogador já foi eliminado por W.O em rodadas anteriores
      supabase
        .from("match_results")
        .select("id")
        .eq("tournament_id", tournamentId)
        .eq("player_id", value)
        .eq("penalidades", "Eliminado por W.O")
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) applyWO();
        });
    }
  };

  const addSecondPlayer = () => {
    if (results.length < 2) setResults(prev => [...prev, { ...emptyResult(), pontos_jogo: "0" }]);
  };

  const resolvePenalidade = (r: PlayerResult): string => {
    if (r.penalidade_tipo === "Outra") {
      return r.penalidade_outra.trim() || "Outra";
    }
    return r.penalidade_tipo || "Sem penalidades";
  };

  const handleSave = async () => {
    if (!rodada.trim()) { toast.error("Informe a rodada"); return; }
    if (results.some(r => !r.player_id || !r.pontos_jogo || !r.pontos_mesa)) {
      toast.error("Preencha todos os campos obrigatórios"); return;
    }
    if (results.some(r => r.penalidade_tipo === "Outra" && !r.penalidade_outra.trim())) {
      toast.error("Especifique a penalidade 'Outra'"); return;
    }
    if (isFaseDeGrupos && !grupo.trim()) { toast.error("Grupo não preenchido — selecione um jogador com grupo"); return; }

    setLoading(true);
    // Buscar usuário diretamente da sessão para evitar registro com registered_by=null
    // caso o hook useAuth ainda não tenha hidratado.
    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id ?? user?.id ?? null;
    if (!currentUserId) {
      setLoading(false);
      toast.error("Sessão não encontrada. Faça login novamente.");
      return;
    }
    const toInsert = results.map(r => ({
      tournament_id: tournamentId,
      player_id: r.player_id,
      fase,
      grupo: isFaseDeGrupos ? grupo.trim() : fase,
      rodada: parseInt(rodada),
      pontos_jogo: parseInt(r.pontos_jogo),
      pontos_mesa: parseInt(r.pontos_mesa),
      penalidades: resolvePenalidade(r),
      registered_by: currentUserId,
    }));

    const { error } = await supabase.from("match_results").insert(toInsert);
    if (error) {
      toast.error("Erro ao salvar resultados");
    } else {
      toast.success("Resultados registrados!");
      setResults([emptyResult()]);
      setGrupo("");
      setRodada("");
    }
    setLoading(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle>Registrar Resultados</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fase-select">Fase</Label>
            <Select value={fase} onValueChange={setFase}>
              <SelectTrigger id="fase-select" aria-label="Fase"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rodada-input">Rodada</Label>
            <Input id="rodada-input" type="number" min={1} value={rodada} onChange={e => setRodada(e.target.value)} placeholder="Ex: 1" />
          </div>
        </div>

        {results.map((r, idx) => (
          <div key={idx} className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Jogador {idx + 1}</p>
            <div className="space-y-2">
              <Label htmlFor={`jogador-${idx}`}>Jogador</Label>
              <Select value={r.player_id} onValueChange={v => updateResult(idx, "player_id", v)}>
                <SelectTrigger id={`jogador-${idx}`} aria-label={`Jogador ${idx + 1}`}><SelectValue placeholder="Selecione o jogador" /></SelectTrigger>
                <SelectContent>
                  {players.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nick_playroom || p.nome_completo}
                      {p.grupo ? ` (Grupo ${p.grupo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`pontos-vitoria-${idx}`}>Pontos de Vitória</Label>
                <Input id={`pontos-vitoria-${idx}`} type="number" min={0} value={r.pontos_jogo} onChange={e => updateResult(idx, "pontos_jogo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`pontos-mesa-${idx}`}>Pontos de Mesa</Label>
                <Input id={`pontos-mesa-${idx}`} type="number" min={0} value={r.pontos_mesa} onChange={e => updateResult(idx, "pontos_mesa", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`penalidade-${idx}`}>Penalidades <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={r.penalidade_tipo} onValueChange={v => updateResult(idx, "penalidade_tipo", v)}>
                <SelectTrigger id={`penalidade-${idx}`} aria-label={`Penalidade do jogador ${idx + 1}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENALIDADE_OPCOES.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                </SelectContent>
              </Select>
              {r.penalidade_tipo === "Outra" && (
                <>
                  <Label htmlFor={`penalidade-outra-${idx}`} className="sr-only">Especifique a penalidade</Label>
                  <Textarea
                    id={`penalidade-outra-${idx}`}
                    className="mt-2"
                    value={r.penalidade_outra}
                    onChange={e => updateResult(idx, "penalidade_outra", e.target.value)}
                    placeholder="Especifique a penalidade"
                    rows={2}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        {isFaseDeGrupos && (
          <div className="space-y-2">
            <Label htmlFor="grupo-input">Grupo {grupo && <span className="text-muted-foreground font-normal">(auto-preenchido)</span>}</Label>
            <Input id="grupo-input" value={grupo ? `Grupo ${grupo}` : ""} readOnly placeholder="Selecione um jogador para preencher" className="bg-muted" />
          </div>
        )}

        <div className="flex gap-3">
          {results.length < 2 && (
            <Button variant="outline" type="button" onClick={addSecondPlayer}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar outro jogador
            </Button>
          )}
          <Button onClick={handleSave} disabled={loading} className="ml-auto">
            <Save className="h-4 w-4 mr-1" /> {loading ? "Salvando..." : "Salvar Resultados"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
