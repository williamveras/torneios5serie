import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

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

const GRUPOS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function ScheduleTab({ tournamentId }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [grupo, setGrupo] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [date, setDate] = useState<Date>();
  const [horario, setHorario] = useState("");
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editItem, setEditItem] = useState<Schedule | null>(null);
  const [editGrupo, setEditGrupo] = useState("");
  const [editPlayer1, setEditPlayer1] = useState("");
  const [editPlayer2, setEditPlayer2] = useState("");
  const [editDate, setEditDate] = useState<Date>();
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

  async function handleSave() {
    if (!grupo || !player1 || !player2 || !date || !horario) {
      toast.error("Preencha todos os campos.");
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
      grupo,
      data_partida: format(date, "yyyy-MM-dd"),
      horario,
    });
    setLoading(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Partida agendada!");
      setPlayer1("");
      setPlayer2("");
      setDate(undefined);
      setHorario("");
      fetchSchedules();
    }
  }

  function openEdit(s: Schedule) {
    setEditItem(s);
    setEditGrupo(s.grupo);
    setEditPlayer1(s.player1_id);
    setEditPlayer2(s.player2_id);
    setEditDate(parseISO(s.data_partida));
    setEditHorario(s.horario.slice(0, 5)); // "HH:mm"
  }

  async function handleUpdate() {
    if (!editItem || !editGrupo || !editPlayer1 || !editPlayer2 || !editDate || !editHorario) return;
    if (editPlayer1 === editPlayer2) {
      toast.error("Selecione dois jogadores diferentes.");
      return;
    }
    setLoading(true);
    const { error } = await supabase
      .from("match_schedule")
      .update({
        grupo: editGrupo,
        player1_id: editPlayer1,
        player2_id: editPlayer2,
        data_partida: format(editDate, "yyyy-MM-dd"),
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
              <Label>Grupo</Label>
              <Select value={grupo} onValueChange={setGrupo}>
                <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                <SelectContent>
                  {GRUPOS.map((g) => (
                    <SelectItem key={g} value={g}>Grupo {g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horário</Label>
              <Input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Jogador 1</Label>
              <Select value={player1} onValueChange={setPlayer1}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nick_playroom || p.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jogador 2</Label>
              <Select value={player2} onValueChange={setPlayer2}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nick_playroom || p.nome_completo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Data da Partida</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "dd/MM/yyyy") : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Jogador 1</Label>
                <Select value={editPlayer1} onValueChange={setEditPlayer1}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nick_playroom || p.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jogador 2</Label>
                <Select value={editPlayer2} onValueChange={setEditPlayer2}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {players.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nick_playroom || p.nome_completo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {editDate ? format(editDate, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={editDate} onSelect={setEditDate} locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Horário</Label>
              <Input type="time" value={editHorario} onChange={(e) => setEditHorario(e.target.value)} />
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
