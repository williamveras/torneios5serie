import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

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
  data_partida: string;
  horario: string;
  created_at: string;
}

interface Props {
  tournamentId: string;
}

const GRUPOS = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function ScheduleTab({ tournamentId }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [grupo, setGrupo] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [horario, setHorario] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editItem, setEditItem] = useState<Schedule | null>(null);
  const [editGrupo, setEditGrupo] = useState("");
  const [editPlayer1, setEditPlayer1] = useState("");
  const [editPlayer2, setEditPlayer2] = useState("");
  const [editDateInput, setEditDateInput] = useState("");
  const [editHorario, setEditHorario] = useState("");

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchPlayers();
    fetchSchedules();
  }, [tournamentId]);

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
    if (!player1 || !player2 || !dateInput || !horario) {
      toast.error("Preencha todos os campos.");
      return;
    }
    const isoDate = parseDateInput(dateInput);
    if (!isoDate) {
      toast.error("Data inválida. Use o formato DD/MM.");
      return;
    }
    const finalGrupo = grupo || players.find(p => p.id === player1)?.grupo || "";
    if (!finalGrupo) {
      toast.error("Selecione o grupo ou defina os grupos dos jogadores.");
      return;
    }
    if (player1 === player2) {
      toast.error("Selecione dois jogadores diferentes.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("match_schedule").insert({
      tournament_id: tournamentId,
      player1_id: player1,
      player2_id: player2,
      grupo: finalGrupo,
      data_partida: isoDate,
      horario,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Partida agendada!");
      setPlayer1("");
      setPlayer2("");
      setDateInput("");
      setHorario("");
      fetchSchedules();
    }
  }

  function openEdit(s: Schedule) {
    setEditItem(s);
    setEditGrupo(s.grupo);
    setEditPlayer1(s.player1_id);
    setEditPlayer2(s.player2_id);
    setEditDateInput(isoToDDMM(s.data_partida));
    setEditHorario(s.horario.slice(0, 5));
  }

  async function handleUpdate() {
    if (!editItem || !editGrupo || !editPlayer1 || !editPlayer2 || !editDateInput || !editHorario) return;
    if (editPlayer1 === editPlayer2) {
      toast.error("Selecione dois jogadores diferentes.");
      return;
    }
    const isoDate = parseDateInput(editDateInput);
    if (!isoDate) {
      toast.error("Data inválida. Use o formato DD/MM.");
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
        horario: editHorario,
      })
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

  // Group schedules by grupo, then by date
  function groupedSchedules() {
    const grouped: Record<string, Record<string, Schedule[]>> = {};
    for (const s of schedules) {
      if (!grouped[s.grupo]) grouped[s.grupo] = {};
      if (!grouped[s.grupo][s.data_partida]) grouped[s.grupo][s.data_partida] = [];
      grouped[s.grupo][s.data_partida].push(s);
    }
    return grouped;
  }

  function formatDateTitle(dateStr: string) {
    const d = parseISO(dateStr);
    const dayName = format(d, "EEEE", { locale: ptBR });
    const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return `${capitalized} (${format(d, "dd/MM")})`;
  }

  const grouped = groupedSchedules();
  const sortedGrupos = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {/* Formulário */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Plus className="h-5 w-5" /> Agendar Partida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Jogador 1</Label>
              <Select value={player1} onValueChange={(v) => { setPlayer1(v); autoFillGrupo(v); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              <Label>Jogador 2</Label>
              <Select value={player2} onValueChange={(v) => { setPlayer2(v); autoFillGrupo(v); }}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
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
              <Label>Data da Partida</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="DD/MM"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
              />
            </div>
            <div>
              <Label>Horário</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Grupo</Label>
            <Select value={grupo} onValueChange={setGrupo}>
              <SelectTrigger><SelectValue placeholder="Preenchido automaticamente ao escolher o jogador" /></SelectTrigger>
              <SelectContent>
                {GRUPOS.map((g) => (
                  <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? "Salvando..." : "Agendar Partida"}
          </Button>
        </CardContent>
      </Card>

      {/* Visualização */}
      {sortedGrupos.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhuma partida agendada ainda.</p>
      ) : (
        sortedGrupos.map((g) => {
          const dates = Object.keys(grouped[g]).sort();
          return (
            <Card key={g}>
              <CardHeader>
                <CardTitle className="text-lg">Grupo {g}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {dates.map((d) => (
                  <div key={d}>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-2">
                      {formatDateTitle(d)}
                    </h4>
                    <div className="space-y-1">
                      {grouped[g][d].map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50">
                          <span className="text-sm">
                            {getPlayerName(s.player1_id)} e {getPlayerName(s.player2_id)}: <strong>{s.horario.slice(0, 5)}</strong>
                          </span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                              <Pencil className="h-3.5 w-3.5" />
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
            <DialogTitle>Editar Partida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Jogador 1</Label>
                <Select value={editPlayer1} onValueChange={(v) => { setEditPlayer1(v); autoFillEditGrupo(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Jogador 2</Label>
                <Select value={editPlayer2} onValueChange={(v) => { setEditPlayer2(v); autoFillEditGrupo(v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Label>Data</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="DD/MM"
                  value={editDateInput}
                  onChange={(e) => setEditDateInput(e.target.value)}
                />
              </div>
              <div>
                <Label>Horário</Label>
                <Input type="time" value={editHorario} onChange={(e) => setEditHorario(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Grupo</Label>
              <Select value={editGrupo} onValueChange={setEditGrupo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
}
