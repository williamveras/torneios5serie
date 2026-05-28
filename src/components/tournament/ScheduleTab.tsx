import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Trash2, CalendarClock, FileText } from "lucide-react";
import { toast } from "sonner";
import ImportMatchupsDialog from "./ImportMatchupsDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { computeCurrentRound } from "@/lib/rounds";


// Parse "DD/MM" or "DD/MM/YYYY" to "YYYY-MM-DD". Returns null if invalid.
function parseDateInput(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  let year: number;
  if (match[3]) {
    year = parseInt(match[3], 10);
    if (year < 100) year += 2000;
  } else {
    year = new Date().getFullYear();
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoToDDMM(iso: string): string {
  const d = parseISO(iso);
  const currentYear = new Date().getFullYear();
  const dd = format(d, "dd/MM");
  return d.getFullYear() === currentYear ? dd : format(d, "dd/MM/yyyy");
}

type Player = Tables<"players">;

interface Schedule {
  id: string;
  tournament_id: string;
  player1_id: string;
  player2_id: string;
  grupo: string;
  data_partida: string | null;
  horario: string | null;
  observacao: string | null;
  rodada: number | null;
  created_at: string;
}

const NO_DATE_KEY = "__sem_data__";

interface Props {
  tournamentId: string;
  prefillPlayerId?: string | null;
  prefillPlayer2Id?: string | null;
  prefillGrupo?: string | null;
  onPrefillConsumed?: () => void;
}

const GRUPOS = Array.from({ length: 30 }, (_, i) => String(i + 1));

export default function ScheduleTab({ tournamentId, prefillPlayerId, prefillPlayer2Id, prefillGrupo, onPrefillConsumed }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [matchups, setMatchups] = useState<{ player1_id: string; player2_id: string; rodada: number | null; fase: string | null }[]>([]);
  const [results, setResults] = useState<{ player_id: string; rodada: number; fase: string | null }[]>([]);
  const [numeroRodadas, setNumeroRodadas] = useState<number | null>(null);

  const [grupo, setGrupo] = useState("");

  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [horario, setHorario] = useState("");
  const [observacao, setObservacao] = useState("");
  const [rodada, setRodada] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editItem, setEditItem] = useState<Schedule | null>(null);
  const [editGrupo, setEditGrupo] = useState("");
  const [editPlayer1, setEditPlayer1] = useState("");
  const [editPlayer2, setEditPlayer2] = useState("");
  const [editDateInput, setEditDateInput] = useState("");
  const [editHorario, setEditHorario] = useState("");
  const [editObservacao, setEditObservacao] = useState("");
  const [editRodada, setEditRodada] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Import dialog state
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetchPlayers();
    fetchSchedules();
    fetchMatchups();
    fetchResults();
    fetchTournament();
  }, [tournamentId]);

  async function fetchMatchups() {
    const { data } = await supabase
      .from("matchups")
      .select("player1_id, player2_id, rodada, fase")
      .eq("tournament_id", tournamentId);
    if (data) setMatchups(data as any);
  }

  async function fetchResults() {
    const { data } = await supabase
      .from("match_results")
      .select("player_id, rodada, fase")
      .eq("tournament_id", tournamentId);
    if (data) setResults(data as any);
  }

  async function fetchTournament() {
    const { data } = await supabase
      .from("tournaments")
      .select("numero_rodadas")
      .eq("id", tournamentId)
      .maybeSingle();
    if (data) setNumeroRodadas((data as any).numero_rodadas ?? null);
  }


  // Pre-fill from PlayersTab or MatchupsTab
  useEffect(() => {
    if ((prefillPlayerId || prefillPlayer2Id || prefillGrupo) && players.length > 0) {
      if (prefillPlayerId) setPlayer1(prefillPlayerId);
      if (prefillPlayer2Id) setPlayer2(prefillPlayer2Id);
      if (prefillGrupo) {
        setGrupo(prefillGrupo);
      } else if (prefillPlayerId) {
        const p = players.find((pl) => pl.id === prefillPlayerId);
        if (p?.grupo) setGrupo(p.grupo);
      }
      onPrefillConsumed?.();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [prefillPlayerId, prefillPlayer2Id, prefillGrupo, players, onPrefillConsumed]);

  async function fetchPlayers() {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("nome_completo");
    if (data) setPlayers(data);
  }

  async function fetchSchedules() {
    const { data } = await supabase
      .from("match_schedule")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("data_partida")
      .order("horario");
    if (data) setSchedules(data as Schedule[]);
  }

  function getPlayerName(id: string) {
    const p = players.find((p) => p.id === id);
    return p?.nick_playroom || p?.nome_completo || "—";
  }

  // Auto-fill grupo based on selected player
  function autoFillGrupo(playerId: string) {
    const player = players.find(p => p.id === playerId);
    if (player?.grupo) setGrupo(player.grupo);
  }

  function autoFillEditGrupo(playerId: string) {
    const player = players.find(p => p.id === playerId);
    if (player?.grupo) setEditGrupo(player.grupo);
  }

  async function handleSave() {
    if (!player1 || !player2) {
      toast.error("Selecione os dois jogadores.");
      return;
    }
    if (player1 === player2) {
      toast.error("Selecione dois jogadores diferentes.");
      return;
    }
    const hasDate = !!dateInput.trim();
    const hasTime = !!horario;
    const hasObs = !!observacao.trim();
    if (hasDate !== hasTime) {
      toast.error("Informe data E horário, ou deixe ambos vazios usando observação.");
      return;
    }
    if (!hasDate && !hasObs) {
      toast.error("Informe data e horário, ou preencha o campo observação.");
      return;
    }
    let isoDate: string | null = null;
    if (hasDate) {
      isoDate = parseDateInput(dateInput);
      if (!isoDate) {
        toast.error("Data inválida. Use o formato DD/MM.");
        return;
      }
    }
    const finalGrupo = grupo || players.find(p => p.id === player1)?.grupo || "";
    if (!finalGrupo) {
      toast.error("Selecione o grupo ou defina os grupos dos jogadores.");
      return;
    }
    const rodadaNum = rodada.trim() ? parseInt(rodada.trim(), 10) : null;
    if (rodada.trim() && (isNaN(rodadaNum!) || rodadaNum! < 1)) {
      toast.error("Rodada inválida.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("match_schedule").insert({
      tournament_id: tournamentId,
      player1_id: player1,
      player2_id: player2,
      grupo: finalGrupo,
      data_partida: isoDate,
      horario: hasTime ? horario : null,
      observacao: hasObs ? observacao.trim() : null,
      rodada: rodadaNum,
    } as any);
    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Partida agendada!");
      setPlayer1("");
      setPlayer2("");
      setDateInput("");
      setHorario("");
      setObservacao("");
      setRodada("");
      fetchSchedules();
    }
  }

  function openEdit(s: Schedule) {
    setEditItem(s);
    setEditGrupo(s.grupo);
    setEditPlayer1(s.player1_id);
    setEditPlayer2(s.player2_id);
    setEditDateInput(s.data_partida ? isoToDDMM(s.data_partida) : "");
    setEditHorario(s.horario ? s.horario.slice(0, 5) : "");
    setEditObservacao(s.observacao ?? "");
    setEditRodada(s.rodada != null ? String(s.rodada) : "");
  }

  async function handleUpdate() {
    if (!editItem || !editGrupo || !editPlayer1 || !editPlayer2) return;
    if (editPlayer1 === editPlayer2) {
      toast.error("Selecione dois jogadores diferentes.");
      return;
    }
    const hasDate = !!editDateInput.trim();
    const hasTime = !!editHorario;
    const hasObs = !!editObservacao.trim();
    if (hasDate !== hasTime) {
      toast.error("Informe data E horário, ou deixe ambos vazios usando observação.");
      return;
    }
    if (!hasDate && !hasObs) {
      toast.error("Informe data e horário, ou preencha o campo observação.");
      return;
    }
    let isoDate: string | null = null;
    if (hasDate) {
      isoDate = parseDateInput(editDateInput);
      if (!isoDate) {
        toast.error("Data inválida. Use o formato DD/MM.");
        return;
      }
    }
    const editRodadaNum = editRodada.trim() ? parseInt(editRodada.trim(), 10) : null;
    if (editRodada.trim() && (isNaN(editRodadaNum!) || editRodadaNum! < 1)) {
      toast.error("Rodada inválida.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("match_schedule")
      .update({
        grupo: editGrupo,
        player1_id: editPlayer1,
        player2_id: editPlayer2,
        data_partida: isoDate,
        horario: hasTime ? editHorario : null,
        observacao: hasObs ? editObservacao.trim() : null,
        rodada: editRodadaNum,
      } as any)
      .eq("id", editItem.id);
    setLoading(false);
    if (error) {
      toast.error("Erro ao atualizar: " + error.message);
    } else {
      toast.success("Atualizado!");
      setEditItem(null);
      fetchSchedules();
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from("match_schedule").delete().eq("id", deleteId);
    if (error) {
      toast.error("Erro ao apagar: " + error.message);
    } else {
      toast.success("Removido!");
      fetchSchedules();
    }
    setDeleteId(null);
  }

  const NO_ROUND_KEY = "__sem_rodada__";

  // Compute current round from numero_rodadas + matchups + results.
  // Falls back to max(rodada) when numero_rodadas isn't configured.
  const { currentRound, totalRounds, phaseComplete } = computeCurrentRound(
    matchups,
    results,
    numeroRodadas,
  );


  // Group schedules by date → grupo. Only the current round is included.
  function groupedSchedules() {
    const grouped: Record<string, Record<string, Schedule[]>> = {};
    if (currentRound == null) return grouped;
    for (const s of schedules) {
      if (s.rodada !== currentRound) continue;
      const dateKey = s.data_partida || NO_DATE_KEY;
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][s.grupo]) grouped[dateKey][s.grupo] = [];
      grouped[dateKey][s.grupo].push(s);
    }
    return grouped;
  }

  function formatDateTitle(dateStr: string) {
    if (dateStr === NO_DATE_KEY) return "Sem data definida";
    const d = parseISO(dateStr);
    const dayName = format(d, "EEEE", { locale: ptBR });
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalized} (${format(d, "dd/MM")})`;
  }

  const grouped = groupedSchedules();
  const sortedDates = Object.keys(grouped).sort((a, b) => {
    if (a === NO_DATE_KEY) return 1;
    if (b === NO_DATE_KEY) return -1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" /> Agendar Partida
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <FileText className="h-4 w-4 mr-1" /> Importar por texto
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="schedule-player1">Jogador 1</Label>
              <Select value={player1} onValueChange={(v) => { setPlayer1(v); autoFillGrupo(v); }}>
                <SelectTrigger id="schedule-player1" aria-label="Jogador 1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nick_playroom || p.nome_completo}{p.grupo ? ` (Grupo ${p.grupo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="schedule-player2">Jogador 2</Label>
              <Select value={player2} onValueChange={(v) => { setPlayer2(v); autoFillGrupo(v); }}>
                <SelectTrigger id="schedule-player2" aria-label="Jogador 2"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nick_playroom || p.nome_completo}{p.grupo ? ` (Grupo ${p.grupo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="schedule-date">Data da Partida</Label>
              <Input
                id="schedule-date"
                type="text"
                inputMode="numeric"
                placeholder="DD/MM"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="schedule-time">Horário</Label>
              <Input id="schedule-time" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="schedule-obs">Observação (opcional)</Label>
            <Input
              id="schedule-obs"
              type="text"
              placeholder='Ex: "a definir", "W.O" — usado quando não há horário'
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se não houver data/horário, preencha aqui. A observação será exibida no lugar do horário.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="schedule-grupo">Grupo</Label>
              <Input
                id="schedule-grupo"
                type="text"
                value={grupo ? (/^\d+$/.test(grupo) ? `Grupo ${grupo}` : grupo) : ""}
                readOnly
                placeholder="Preenchido automaticamente ao escolher o jogador"
                className="bg-muted"
              />
            </div>
            <div>
              <Label htmlFor="schedule-rodada">Rodada (opcional)</Label>
              <Input
                id="schedule-rodada"
                type="number"
                min={1}
                placeholder="Ex: 1, 2, 3..."
                value={rodada}
                onChange={(e) => setRodada(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Agendar Partida"}
          </Button>
        </CardContent>
      </Card>

      {/* Título separador */}
      <h2 className="text-xl font-semibold pt-2">
        {currentRound != null
          ? `Partidas agendadas — Rodada ${currentRound}${totalRounds ? ` de ${totalRounds}` : ""}${phaseComplete ? " (fase concluída)" : ""}`
          : "Partidas agendadas"}

      </h2>

      {/* Visualização — agrupada por Rodada → Grupo → Data (somente rodada atual) */}
      {currentRound == null ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma rodada atual definida.</p>
      ) : sortedDates.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma partida agendada para a rodada {currentRound}.</p>
      ) : (
        sortedDates.map((dk) => {
          const grupos = Object.keys(grouped[dk]).sort((a, b) => {
            const an = parseInt(a, 10);
            const bn = parseInt(b, 10);
            if (!isNaN(an) && !isNaN(bn)) return an - bn;
            return a.localeCompare(b);
          });
          return (
            <Card key={dk}>
              <CardHeader>
                <CardTitle className="text-lg">{formatDateTitle(dk)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {grupos.map((g) => (
                  <div key={g}>
                    <h3 className="font-semibold text-sm mb-2">
                      {/^\d+$/.test(g) ? `Grupo ${g}` : g}
                    </h3>
                    <div className="space-y-1 pl-2">
                      {grouped[dk][g].map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50">
                          <span className="text-sm">
                            {getPlayerName(s.player1_id)} e {getPlayerName(s.player2_id)}:{" "}
                            <strong>{s.horario ? s.horario.slice(0, 5) : (s.observacao || "—")}</strong>
                          </span>
                          <div className="flex gap-1">
                            <Button variant="outline" size="sm" className="h-7" onClick={() => openEdit(s)}>
                              <CalendarClock className="h-3.5 w-3.5 mr-1" /> Realocar
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(s.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })
      )}


      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Realocar Partida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-schedule-player1">Jogador 1</Label>
                <Select value={editPlayer1} onValueChange={(v) => { setEditPlayer1(v); autoFillEditGrupo(v); }}>
                  <SelectTrigger id="edit-schedule-player1" aria-label="Jogador 1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nick_playroom || p.nome_completo}{p.grupo ? ` (Grupo ${p.grupo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-schedule-player2">Jogador 2</Label>
                <Select value={editPlayer2} onValueChange={(v) => { setEditPlayer2(v); autoFillEditGrupo(v); }}>
                  <SelectTrigger id="edit-schedule-player2" aria-label="Jogador 2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nick_playroom || p.nome_completo}{p.grupo ? ` (Grupo ${p.grupo})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-schedule-date">Data</Label>
                <Input
                  id="edit-schedule-date"
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM"
                  value={editDateInput}
                  onChange={(e) => setEditDateInput(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="edit-schedule-time">Horário</Label>
                <Input id="edit-schedule-time" type="time" value={editHorario} onChange={(e) => setEditHorario(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-schedule-obs">Observação (opcional)</Label>
              <Input
                id="edit-schedule-obs"
                type="text"
                placeholder='Ex: "a definir", "W.O"'
                value={editObservacao}
                onChange={(e) => setEditObservacao(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-schedule-grupo">Grupo</Label>
                <Input
                  id="edit-schedule-grupo"
                  type="text"
                  value={editGrupo ? (/^\d+$/.test(editGrupo) ? `Grupo ${editGrupo}` : editGrupo) : ""}
                  readOnly
                  placeholder="Preenchido automaticamente ao escolher o jogador"
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="edit-schedule-rodada">Rodada (opcional)</Label>
                <Input
                  id="edit-schedule-rodada"
                  type="number"
                  min={1}
                  placeholder="Ex: 1, 2, 3..."
                  value={editRodada}
                  onChange={(e) => setEditRodada(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={loading}>{loading ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja apagar esta partida agendada?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportMatchupsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        tournamentId={tournamentId}
        players={players}
        onImported={() => {
          fetchSchedules();
          fetchMatchups();
        }}
      />
    </div>
  );
}
