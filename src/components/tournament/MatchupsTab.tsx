import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Shuffle, Trash2, CalendarPlus, Wand2, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { FASES, type Fase } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;
type Matchup = Tables<"matchups">;

type Mode = "por_grupo" | "geral";

interface DraftMatch {
  player1_id: string;
  player2_id: string | null; // null = BYE
  grupo: string;
  rodada?: number;
}

interface Props {
  tournamentId: string;
  onScheduleMatchup: (player1Id: string, player2Id: string, grupo: string) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Round-robin (circle method). Returns rounds; each round is array of [p1, p2] pairs.
// If odd count, a null is added to represent BYE.
function roundRobin(playerIds: string[]): Array<Array<[string, string | null]>> {
  const ids: (string | null)[] = [...playerIds];
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const rounds: Array<Array<[string, string | null]>> = [];
  const fixed = ids[0];
  let rotating = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[string, string | null]> = [];
    const arrangement = [fixed, ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const a = arrangement[i];
      const b = arrangement[n - 1 - i];
      if (a !== null && b !== null) round.push([a, b]);
      else if (a !== null) round.push([a, null]);
      else if (b !== null) round.push([b, null]);
    }
    rounds.push(round);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }
  return rounds;
}

export default function MatchupsTab({ tournamentId, onScheduleMatchup }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [fase, setFase] = useState<Fase>("Fase de Grupos");
  const [mode, setMode] = useState<Mode>("por_grupo");
  const [rodadaGeral, setRodadaGeral] = useState("");
  const [drafts, setDrafts] = useState<DraftMatch[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState<{ existingCount: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
    fetchMatchups();
  }, [tournamentId]);

  // Auto-adjust mode when fase changes
  useEffect(() => {
    if (fase === "Fase de Grupos") setMode("por_grupo");
    else setMode("geral");
  }, [fase]);

  async function fetchPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("nome_completo");
    if (data) setPlayers(data);
  }

  async function fetchMatchups() {
    const { data } = await supabase
      .from("matchups")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at");
    if (data) setMatchups(data);
  }

  function getPlayerName(id: string) {
    const p = players.find((p) => p.id === id);
    return p?.nick_playroom || p?.nome_completo || "—";
  }

  const hasGroups = players.some((p) => p.grupo);
  const canPorGrupo = fase === "Fase de Grupos" && hasGroups;

  function generate() {
    if (players.length < 2) {
      toast.error("É necessário ter pelo menos 2 jogadores cadastrados.");
      return;
    }

    const newDrafts: DraftMatch[] = [];

    if (mode === "por_grupo") {
      if (!hasGroups) {
        toast.error("Defina os grupos dos jogadores na aba Participantes antes de gerar.");
        return;
      }
      const byGroup = new Map<string, Player[]>();
      players.forEach((p) => {
        if (!p.grupo) return;
        const list = byGroup.get(p.grupo) || [];
        list.push(p);
        byGroup.set(p.grupo, list);
      });
      const sortedGroups = [...byGroup.keys()].sort((a, b) => Number(a) - Number(b));
      for (const g of sortedGroups) {
        const list = shuffle(byGroup.get(g)!);
        const rounds = roundRobin(list.map((p) => p.id));
        rounds.forEach((round, idx) => {
          round.forEach(([a, b]) => {
            newDrafts.push({ player1_id: a, player2_id: b, grupo: g, rodada: idx + 1 });
          });
        });
      }
    } else {
      // geral: random pairs across all players
      const shuffled = shuffle(players.map((p) => p.id));
      const grupoLabel = fase === "Fase de Grupos" ? "Geral" : fase;
      const rodadaNum = rodadaGeral.trim() ? parseInt(rodadaGeral.trim(), 10) : undefined;
      if (rodadaGeral.trim() && (rodadaNum === undefined || isNaN(rodadaNum) || rodadaNum < 1)) {
        toast.error("Rodada inválida.");
        return;
      }
      for (let i = 0; i < shuffled.length; i += 2) {
        const a = shuffled[i];
        const b = shuffled[i + 1] ?? null;
        newDrafts.push({ player1_id: a, player2_id: b, grupo: grupoLabel, rodada: rodadaNum });
      }
    }

    setDrafts(newDrafts);
    const valid = newDrafts.filter((d) => d.player2_id).length;
    const byes = newDrafts.length - valid;
    toast.success(`${valid} confronto(s) gerado(s)${byes ? ` (${byes} BYE)` : ""}.`);
  }

  function removeDraft(idx: number) {
    setDrafts((d) => d.filter((_, i) => i !== idx));
  }

  async function trySave() {
    const existing = matchups.filter((m) => m.fase === fase);
    if (existing.length > 0) {
      setConfirmReplace({ existingCount: existing.length });
      return;
    }
    await persistDrafts(false);
  }

  async function persistDrafts(replace: boolean) {
    const valid = drafts.filter((d) => d.player2_id);
    if (valid.length === 0) {
      toast.error("Nenhum confronto válido para salvar.");
      return;
    }
    setSaving(true);
    if (replace) {
      const { error: delErr } = await supabase
        .from("matchups")
        .delete()
        .eq("tournament_id", tournamentId)
        .eq("fase", fase);
      if (delErr) {
        setSaving(false);
        toast.error("Erro ao substituir: " + delErr.message);
        return;
      }
    }
    const rows = valid.map((d) => ({
      tournament_id: tournamentId,
      fase,
      grupo: d.grupo,
      player1_id: d.player1_id,
      player2_id: d.player2_id!,
      rodada: d.rodada ?? null,
    }));
    const { error } = await supabase.from("matchups").insert(rows);
    setSaving(false);
    setConfirmReplace(null);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success(`${rows.length} confronto(s) salvo(s)!`);
      setDrafts([]);
      fetchMatchups();
    }
  }

  async function deleteMatchup() {
    if (!deleteId) return;
    const { error } = await supabase.from("matchups").delete().eq("id", deleteId);
    if (error) toast.error("Erro ao remover: " + error.message);
    else {
      toast.success("Confronto removido.");
      fetchMatchups();
    }
    setDeleteId(null);
  }

  // Group saved matchups by fase, then by grupo, then by rodada (if any)
  const grouped = (() => {
    const byFase: Record<string, Record<string, Matchup[]>> = {};
    for (const m of matchups) {
      byFase[m.fase] ??= {};
      byFase[m.fase][m.grupo] ??= [];
      byFase[m.fase][m.grupo].push(m);
    }
    return byFase;
  })();

  const sortedSavedFases = FASES.filter((f) => grouped[f]);

  return (
    <div className="space-y-6">
      {/* Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5" /> Gerar Confrontos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="matchup-fase">Fase</Label>
              <Select value={fase} onValueChange={(v) => setFase(v as Fase)}>
                <SelectTrigger id="matchup-fase"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASES.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modo de sorteio</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="mode-por-grupo" value="por_grupo" disabled={!canPorGrupo} />
                  <Label htmlFor="mode-por-grupo" className={!canPorGrupo ? "text-muted-foreground" : ""}>
                    Por grupo
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="mode-geral" value="geral" />
                  <Label htmlFor="mode-geral">Geral (sorteio entre todos)</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          {mode === "por_grupo" && !hasGroups && (
            <p className="text-xs text-destructive">
              Nenhum grupo definido. Vá em Participantes → Sortear Grupos antes de gerar.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={generate}>
              <Shuffle className="h-4 w-4 mr-1" /> Gerar Confrontos
            </Button>
            {drafts.length > 0 && (
              <>
                <Button variant="outline" onClick={generate}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Embaralhar novamente
                </Button>
                <Button variant="default" onClick={trySave} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar Confrontos"}
                </Button>
                <Button variant="ghost" onClick={() => setDrafts([])}>Descartar</Button>
              </>
            )}
          </div>

          {/* Drafts preview */}
          {drafts.length > 0 && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm font-medium">Pré-visualização ({drafts.filter(d => d.player2_id).length} confrontos)</p>
              {(() => {
                const byGroup = new Map<string, Array<{ d: DraftMatch; idx: number }>>();
                drafts.forEach((d, idx) => {
                  const list = byGroup.get(d.grupo) || [];
                  list.push({ d, idx });
                  byGroup.set(d.grupo, list);
                });
                const groups = [...byGroup.keys()].sort();
                return groups.map((g) => {
                  const items = byGroup.get(g)!;
                  const byRound = new Map<number, Array<{ d: DraftMatch; idx: number }>>();
                  const noRound: Array<{ d: DraftMatch; idx: number }> = [];
                  items.forEach((it) => {
                    if (it.d.rodada != null) {
                      const list = byRound.get(it.d.rodada) || [];
                      list.push(it);
                      byRound.set(it.d.rodada, list);
                    } else {
                      noRound.push(it);
                    }
                  });
                  const rounds = [...byRound.keys()].sort((a, b) => a - b);
                  return (
                    <div key={g} className="rounded-md border p-3 bg-muted/30">
                      <p className="font-semibold text-sm mb-2">
                        {fase === "Fase de Grupos" ? `Grupo ${g}` : g}
                      </p>
                      {rounds.map((r) => (
                        <div key={r} className="mb-2">
                          <p className="text-xs text-muted-foreground mb-1">Rodada {r}</p>
                          <div className="space-y-1">
                            {byRound.get(r)!.map(({ d, idx }) => (
                              <DraftRow key={idx} d={d} idx={idx} getPlayerName={getPlayerName} onRemove={removeDraft} />
                            ))}
                          </div>
                        </div>
                      ))}
                      {noRound.length > 0 && (
                        <div className="space-y-1">
                          {noRound.map(({ d, idx }) => (
                            <DraftRow key={idx} d={d} idx={idx} getPlayerName={getPlayerName} onRemove={removeDraft} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved matchups */}
      {sortedSavedFases.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum confronto salvo ainda.</p>
      ) : (
        sortedSavedFases.map((f) => {
          const groups = Object.keys(grouped[f]).sort((a, b) => {
            const na = Number(a), nb = Number(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b);
          });
          return (
            <Card key={f}>
              <CardHeader>
                <CardTitle className="text-lg">{f}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groups.map((g) => {
                  const list = grouped[f][g];
                  const byRound = new Map<number | "_", Matchup[]>();
                  list.forEach((m) => {
                    const k = m.rodada ?? "_";
                    const arr = byRound.get(k) || [];
                    arr.push(m);
                    byRound.set(k, arr);
                  });
                  const keys = [...byRound.keys()].sort((a, b) => {
                    if (a === "_") return 1;
                    if (b === "_") return -1;
                    return (a as number) - (b as number);
                  });
                  return (
                    <div key={g}>
                      <h4 className="font-semibold text-sm mb-2">
                        {f === "Fase de Grupos" ? `Grupo ${g}` : g}
                      </h4>
                      {keys.map((k) => (
                        <div key={String(k)} className="mb-2">
                          {k !== "_" && (
                            <p className="text-xs text-muted-foreground mb-1">Rodada {k}</p>
                          )}
                          <div className="space-y-1">
                            {byRound.get(k)!.map((m) => (
                              <div key={m.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50">
                                <span className="text-sm">
                                  {getPlayerName(m.player1_id)} <span className="text-muted-foreground">vs</span> {getPlayerName(m.player2_id)}
                                </span>
                                <div className="flex gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7"
                                    onClick={() => onScheduleMatchup(m.player1_id, m.player2_id, m.grupo)}
                                  >
                                    <CalendarPlus className="h-3.5 w-3.5 mr-1" /> Agendar partida
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive"
                                    onClick={() => setDeleteId(m.id)}
                                    aria-label="Remover confronto"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Replace confirmation */}
      <AlertDialog open={!!confirmReplace} onOpenChange={(open) => !open && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir confrontos existentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Já existem <strong>{confirmReplace?.existingCount}</strong> confronto(s) salvos para a fase <strong>{fase}</strong>.
              Você quer substituí-los pelos novos confrontos gerados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => persistDrafts(true)}>Substituir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover confronto?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteMatchup}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DraftRow({
  d,
  idx,
  getPlayerName,
  onRemove,
}: {
  d: DraftMatch;
  idx: number;
  getPlayerName: (id: string) => string;
  onRemove: (idx: number) => void;
}) {
  const isBye = !d.player2_id;
  return (
    <div className={`flex items-center justify-between py-1.5 px-3 rounded-md ${isBye ? "bg-accent/40 border border-dashed" : "bg-background"}`}>
      <span className="text-sm">
        {getPlayerName(d.player1_id)}{" "}
        {isBye ? (
          <span className="text-muted-foreground font-medium">— BYE</span>
        ) : (
          <>
            <span className="text-muted-foreground">vs</span> {getPlayerName(d.player2_id!)}
          </>
        )}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(idx)} aria-label="Remover">
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
