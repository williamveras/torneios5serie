import { Fragment, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import { isGroupPhase, buildMesaMap, pairKey, type MatchupLite } from "@/lib/phase";
import { parseResultsText, type ParsedResult, type TeamMemberLite } from "@/lib/resultsParser";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

const PENALIDADE_OPCOES = ["Sem penalidades", "W.O", "Eliminado por W.O", "Digitação na mesa", "Outra"] as const;

interface BlockState {
  parsed: ParsedResult;
  penalidade1: string;
  penalidade1Outra: string;
  penalidade2: string;
  penalidade2Outra: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  players: Player[];
  activeFase?: string;
  lowerWins?: boolean;
  onImported: () => void;
}

export default function ImportResultsDialog({ open, onOpenChange, tournamentId, players, activeFase, lowerWins, onImported }: Props) {
  const { user } = useAuth();
  const [fase, setFase] = useState<string>(activeFase || "Fase de Grupos");
  const [rodada, setRodada] = useState<string>("");
  const [text, setText] = useState("");
  const [blocks, setBlocks] = useState<BlockState[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [matchups, setMatchups] = useState<MatchupLite[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberLite[]>([]);

  const isFaseDeGrupos = isGroupPhase(fase);

  useEffect(() => {
    if (activeFase) setFase(activeFase);
  }, [activeFase]);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("matchups")
      .select("id, fase, player1_id, player2_id, created_at")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMatchups(data as any); });

    const teamIds = players.filter((p: any) => p.is_team).map((p) => p.id);
    if (teamIds.length > 0) {
      supabase
        .from("team_members")
        .select("team_id, member_nome, member_nick")
        .in("team_id", teamIds)
        .then(({ data }) => { if (data) setTeamMembers(data as any); });
    } else {
      setTeamMembers([]);
    }
  }, [open, tournamentId, players]);

  const mesaMap = !isFaseDeGrupos ? buildMesaMap(matchups, fase) : new Map<string, number>();

  function reset() {
    setRodada("");
    setText("");
    setBlocks(null);
  }

  function handlePreview() {
    if (isFaseDeGrupos && (!rodada || isNaN(parseInt(rodada, 10)))) {
      toast.error("Informe a rodada (número).");
      return;
    }
    if (!text.trim()) {
      toast.error("Cole o texto dos resultados.");
      return;
    }
    const parsed = parseResultsText(text, players, { lowerWins: !!lowerWins, teamMembers });
    if (parsed.length === 0) {
      toast.error("Nenhum resultado detectado no texto.");
      return;
    }
    setBlocks(
      parsed.map((p) => ({
        parsed: p,
        penalidade1: "Sem penalidades",
        penalidade1Outra: "",
        penalidade2: "Sem penalidades",
        penalidade2Outra: "",
      }))
    );
  }

  function updateBlock(i: number, patch: Partial<BlockState>) {
    setBlocks((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  }

  function resolvePenalidade(tipo: string, outra: string): string {
    if (tipo === "Outra") return outra.trim() || "Outra";
    return tipo || "Sem penalidades";
  }

  async function handleConfirm() {
    if (!blocks) return;
    const rdGroup = isFaseDeGrupos ? parseInt(rodada, 10) : NaN;

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData.session?.user?.id ?? user?.id ?? null;
    if (!currentUserId) {
      toast.error("Sessão não encontrada. Faça login novamente.");
      return;
    }

    const valid = blocks.filter(
      (b) =>
        b.parsed.players.length === 2 &&
        b.parsed.players.every((pl) => pl.playerId) &&
        b.parsed.players.some((pl) => pl.pontosJogo === 3) &&
        (!isFaseDeGrupos || b.parsed.grupo)
    );
    if (valid.length === 0) {
      toast.error("Nenhum bloco válido para gravar.");
      return;
    }

    setSaving(true);
    let inserted = 0;
    let failed = 0;

    for (let i = 0; i < valid.length; i++) {
      const b = valid[i];
      const grupo = isFaseDeGrupos ? (b.parsed.grupo as string) : fase;
      let rd: number;
      if (isFaseDeGrupos) {
        rd = rdGroup;
      } else {
        const [p1, p2] = b.parsed.players;
        const mesa = mesaMap.get(pairKey(p1.playerId!, p2.playerId!));
        rd = mesa ?? (i + 1);
      }
      const toInsert = b.parsed.players.map((pl, idx) => ({
        tournament_id: tournamentId,
        player_id: pl.playerId!,
        fase,
        grupo,
        rodada: rd,
        pontos_jogo: pl.pontosJogo,
        pontos_mesa: pl.pontosMesa,
        penalidades: idx === 0
          ? resolvePenalidade(b.penalidade1, b.penalidade1Outra)
          : resolvePenalidade(b.penalidade2, b.penalidade2Outra),
        registered_by: currentUserId,
        data_partida: b.parsed.data ?? null,
        horario: b.parsed.horario ?? null,
      }));

      const { error } = await supabase.from("match_results").insert(toInsert);
      if (error) failed++;
      else inserted++;
    }

    setSaving(false);
    toast.success(
      `Importação concluída: ${inserted} partida(s) gravada(s)${failed ? `, ${failed} com erro` : ""}.`
    );
    onImported();
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar resultados por texto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {lowerWins && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
              Este torneio usa <strong>menor pontuação vence</strong>: quando não houver linha "X ganhou!", o vencedor será o de menor pontuação.
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="import-res-fase">Fase</Label>
              <Select value={fase} onValueChange={setFase}>
                <SelectTrigger id="import-res-fase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {isFaseDeGrupos && (
              <div>
                <Label htmlFor="import-res-rodada">Rodada</Label>
                <Input
                  id="import-res-rodada"
                  type="number"
                  min={1}
                  value={rodada}
                  onChange={(e) => setRodada(e.target.value)}
                  placeholder="Ex: 4"
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="import-res-text">Texto colado</Label>
            <Textarea
              id="import-res-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Exemplo:\n\nPontuações:\nLyly01: 26.\nprincesinha: 17.\nLyly01 ganhou!`}
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Você pode colar várias partidas, separadas por linha em branco. O grupo é detectado automaticamente pelo jogador.
            </p>
          </div>

          {!blocks ? (
            <div className="flex justify-end">
              <Button onClick={handlePreview}>Pré-visualizar</Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isFaseDeGrupos ? "Grupo" : "Mesa"}</TableHead>
                      <TableHead>Jogador</TableHead>
                      <TableHead>Vitória</TableHead>
                      <TableHead>Mesa</TableHead>
                      <TableHead>Penalidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocks.map((b, i) => {
                      const mesaForBlock = !isFaseDeGrupos
                        ? (b.parsed.players[0]?.playerId && b.parsed.players[1]?.playerId
                            ? mesaMap.get(pairKey(b.parsed.players[0].playerId!, b.parsed.players[1].playerId!)) ?? (i + 1)
                            : i + 1)
                        : null;
                      return (
                      <Fragment key={i}>
                        {b.parsed.players.map((pl, idx) => (
                          <TableRow key={`${i}-${idx}`} className={b.parsed.errors.length > 0 ? "bg-destructive/10" : ""}>
                            {idx === 0 && (
                              <TableCell rowSpan={2} className="align-top">
                                {isFaseDeGrupos ? (b.parsed.grupo || <span className="text-destructive">?</span>) : `Mesa ${mesaForBlock}`}
                              </TableCell>
                            )}
                            <TableCell>
                              <div className="text-sm">{pl.playerName}</div>
                              {!pl.playerId && <div className="text-xs text-destructive">não encontrado</div>}
                            </TableCell>
                            <TableCell className="font-mono">{pl.pontosJogo}</TableCell>
                            <TableCell className="font-mono">{pl.pontosMesa}</TableCell>
                            <TableCell>
                              <Select
                                value={idx === 0 ? b.penalidade1 : b.penalidade2}
                                onValueChange={(v) => updateBlock(i, idx === 0 ? { penalidade1: v } : { penalidade2: v })}
                              >
                                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {PENALIDADE_OPCOES.map((op) => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {((idx === 0 && b.penalidade1 === "Outra") || (idx === 1 && b.penalidade2 === "Outra")) && (
                                <Input
                                  className="mt-1 h-8"
                                  placeholder="Especifique"
                                  value={idx === 0 ? b.penalidade1Outra : b.penalidade2Outra}
                                  onChange={(e) => updateBlock(i, idx === 0 ? { penalidade1Outra: e.target.value } : { penalidade2Outra: e.target.value })}
                                />
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {b.parsed.errors.length > 0 && (
                          <TableRow className="bg-destructive/10">
                            <TableCell colSpan={5} className="text-xs text-destructive">
                              {b.parsed.errors.join(" ")}
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Vencedor recebe 3 pontos de vitória; o outro, 0. Mesa = pontuação informada. Linhas com erro serão ignoradas.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          {blocks && (
            <>
              <Button variant="outline" onClick={() => setBlocks(null)}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? "Gravando..." : "Confirmar e gravar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
