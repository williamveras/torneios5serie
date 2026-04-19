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

const PENALIDADE_OPCOES = ["Sem penalidades", "W.O", "Digitação na mesa", "Outra"] as const;

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
  };

  const addSecondPlayer = () => {
    if (results.length < 2) setResults(prev => [...prev, emptyResult()]);
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
    const toInsert = results.map(r => ({
      tournament_id: tournamentId,
      player_id: r.player_id,
      fase,
      grupo: isFaseDeGrupos ? grupo.trim() : fase,
      rodada: parseInt(rodada),
      pontos_jogo: parseInt(r.pontos_jogo),
      pontos_mesa: parseInt(r.pontos_mesa),
      penalidades: resolvePenalidade(r),
      registered_by: user?.id || null,
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
            <Label>Fase</Label>
            <Select value={fase} onValueChange={setFase}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FASES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Rodada</Label>
            <Input type="number" min={1} value={rodada} onChange={e => setRodada(e.target.value)} placeholder="Ex: 1" />
          </div>
        </div>

        {results.map((r, idx) => (
          <div key={idx} className="p-4 border rounded-lg space-y-4 bg-muted/30">
            <p className="text-sm font-medium text-muted-foreground">Jogador {idx + 1}</p>
            <div className="space-y-2">
              <Label>Jogador</Label>
              <Select value={r.player_id} onValueChange={v => updateResult(idx, "player_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o jogador" /></SelectTrigger>
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
                <Label>Pontos de Jogo</Label>
                <Input type="number" min={0} value={r.pontos_jogo} onChange={e => updateResult(idx, "pontos_jogo", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pontos de Mesa</Label>
                <Input type="number" min={0} value={r.pontos_mesa} onChange={e => updateResult(idx, "pontos_mesa", e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Penalidades <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Select value={r.penalidade_tipo} onValueChange={v => updateResult(idx, "penalidade_tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENALIDADE_OPCOES.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                </SelectContent>
              </Select>
              {r.penalidade_tipo === "Outra" && (
                <Textarea
                  className="mt-2"
                  value={r.penalidade_outra}
                  onChange={e => updateResult(idx, "penalidade_outra", e.target.value)}
                  placeholder="Especifique a penalidade"
                  rows={2}
                />
              )}
            </div>
          </div>
        ))}

        {isFaseDeGrupos && (
          <div className="space-y-2">
            <Label>Grupo {grupo && <span className="text-muted-foreground font-normal">(auto-preenchido)</span>}</Label>
            <Input value={grupo ? `Grupo ${grupo}` : ""} readOnly placeholder="Selecione um jogador para preencher" className="bg-muted" />
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
