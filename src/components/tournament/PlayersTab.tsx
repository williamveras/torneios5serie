import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Users, Shuffle, Lightbulb, MoreHorizontal, Pencil, CalendarPlus, Ban, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

interface Props {
  tournamentId: string;
  onScheduleMatch?: (playerId: string) => void;
}

function suggestGroupSize(total: number): number {
  if (total <= 3) return total;
  let best = 4;
  let bestRemainder = total;
  for (let size = 3; size <= 8; size++) {
    const remainder = total % size;
    if (remainder < bestRemainder || (remainder === bestRemainder && size > best)) {
      bestRemainder = remainder;
      best = size;
    }
  }
  return best;
}

function distributeIntoGroups(players: Player[], perGroup: number): Map<string, string> {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const numGroups = Math.ceil(shuffled.length / perGroup);
  const map = new Map<string, string>();
  shuffled.forEach((p, i) => {
    const groupIndex = i % numGroups;
    const groupLetter = String(groupIndex + 1);
    map.set(p.id, groupLetter);
  });
  return map;
}

export default function PlayersTab({ tournamentId, onScheduleMatch }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [perGroup, setPerGroup] = useState<string>("4");
  const [sorting, setSorting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Edit dialog state
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editNick, setEditNick] = useState("");
  const [editWhats, setEditWhats] = useState("");
  const [editHorarios, setEditHorarios] = useState("");
  const [editGrupo, setEditGrupo] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);

  const fetchPlayers = async () => {
    const { data } = await supabase.from("players").select("*").eq("tournament_id", tournamentId).order("grupo").order("nome_completo");
    if (data) setPlayers(data);
  };

  useEffect(() => { fetchPlayers(); }, [tournamentId]);

  const hasGroups = players.some(p => p.grupo);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) { toast.error("Planilha vazia"); return; }

    const findCol = (row: Record<string, string>, keywords: string[]) => {
      const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
      return key ? String(row[key] ?? "").trim() : "";
    };

    const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();
    const existingNomes = new Set(players.map(p => norm(p.nome_completo)));
    const existingNicks = new Set(players.map(p => norm(p.nick_playroom)).filter(Boolean));

    const seenNomes = new Set<string>();
    const seenNicks = new Set<string>();
    let skipped = 0;

    const playersToInsert = rows.map(row => ({
      tournament_id: tournamentId,
      nome_completo: findCol(row, ["nome"]) || Object.values(row)[0]?.toString() || "Sem nome",
      nick_playroom: findCol(row, ["nick", "playroom"]) || null,
      whatsapp: findCol(row, ["whatsapp", "telefone", "celular", "ddd"]) || null,
      preferencia_horarios: findCol(row, ["horário", "horario", "preferência", "preferencia"]) || null,
      comentario: findCol(row, ["comentário", "comentario", "adicional", "observação"]) || null,
    })).filter(p => {
      const nome = norm(p.nome_completo);
      const nick = norm(p.nick_playroom);
      const isDupDb = existingNomes.has(nome) || (nick && existingNicks.has(nick));
      const isDupFile = seenNomes.has(nome) || (nick && seenNicks.has(nick));
      if (isDupDb || isDupFile) { skipped++; return false; }
      seenNomes.add(nome);
      if (nick) seenNicks.add(nick);
      return true;
    });

    if (playersToInsert.length === 0) {
      toast.info(`Nenhum jogador novo. ${skipped} duplicata(s) ignorada(s).`);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    const { error } = await supabase.from("players").insert(playersToInsert);
    if (error) {
      toast.error("Erro ao importar jogadores");
    } else {
      toast.success(`${playersToInsert.length} jogador(es) importado(s)!${skipped > 0 ? ` ${skipped} duplicata(s) ignorada(s).` : ""}`);
      fetchPlayers();
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async () => {
    if (!deletePlayer) return;
    const { error } = await supabase.from("players").delete().eq("id", deletePlayer.id);
    if (error) toast.error("Erro ao remover jogador");
    else { toast.success("Jogador removido"); fetchPlayers(); }
    setDeletePlayer(null);
  };

  const openEdit = (p: Player) => {
    setEditPlayer(p);
    setEditNome(p.nome_completo);
    setEditNick(p.nick_playroom || "");
    setEditWhats(p.whatsapp || "");
    setEditHorarios(p.preferencia_horarios || "");
    setEditGrupo(p.grupo || "");
  };

  const handleSaveEdit = async () => {
    if (!editPlayer) return;
    if (!editNome.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingEdit(true);
    const { error } = await supabase.from("players").update({
      nome_completo: editNome.trim(),
      nick_playroom: editNick.trim() || null,
      whatsapp: editWhats.trim() || null,
      preferencia_horarios: editHorarios.trim() || null,
      grupo: editGrupo.trim() || null,
    }).eq("id", editPlayer.id);
    setSavingEdit(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success("Jogador atualizado");
      setEditPlayer(null);
      fetchPlayers();
    }
  };

  const toggleEliminado = async (p: Player) => {
    const novoValor = !p.eliminado;
    const { error } = await supabase.from("players").update({ eliminado: novoValor }).eq("id", p.id);
    if (error) toast.error("Erro ao atualizar status");
    else {
      toast.success(novoValor ? "Jogador marcado como eliminado por W.O" : "Eliminação removida");
      fetchPlayers();
    }
  };

  const handleSuggest = () => {
    const suggestion = suggestGroupSize(players.length);
    setPerGroup(String(suggestion));
    toast.info(`Sugestão: ${suggestion} jogadores por grupo (${Math.ceil(players.length / suggestion)} grupos)`);
  };

  const handleSortear = async () => {
    const size = parseInt(perGroup);
    if (!size || size < 2) { toast.error("Informe pelo menos 2 jogadores por grupo"); return; }
    if (players.length < size) { toast.error("Poucos jogadores para essa configuração"); return; }

    setSorting(true);
    const distribution = distributeIntoGroups(players, size);

    const updates = Array.from(distribution.entries()).map(([id, grupo]) =>
      supabase.from("players").update({ grupo }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast.error("Erro ao sortear grupos");
    } else {
      const numGroups = Math.ceil(players.length / size);
      toast.success(`Jogadores distribuídos em ${numGroups} grupo(s)!`);
      fetchPlayers();
    }
    setSorting(false);
  };

  const handleClearGroups = async () => {
    setSorting(true);
    const updates = players.map(p =>
      supabase.from("players").update({ grupo: null }).eq("id", p.id)
    );
    await Promise.all(updates);
    toast.success("Grupos limpos!");
    fetchPlayers();
    setSorting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{players.length} participante(s)</p>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importar Planilha
          </Button>
        </div>
      </div>

      {/* Sortear Grupos */}
      {players.length >= 2 && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium">Distribuição de Grupos</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label htmlFor="per-group-input" className="text-xs">Jogadores por grupo</Label>
                <Input
                  id="per-group-input"
                  type="number"
                  min={2}
                  max={players.length}
                  value={perGroup}
                  onChange={e => setPerGroup(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSuggest}>
                <Lightbulb className="h-4 w-4 mr-1" /> Sugerir
              </Button>
              <Button size="sm" onClick={handleSortear} disabled={sorting}>
                <Shuffle className="h-4 w-4 mr-1" /> {sorting ? "Sorteando..." : "Sortear Grupos"}
              </Button>
              {hasGroups && (
                <Button variant="ghost" size="sm" onClick={handleClearGroups} disabled={sorting}>
                  Limpar Grupos
                </Button>
              )}
            </div>
            {hasGroups && (
              <p className="text-xs text-muted-foreground">
                Os grupos já foram definidos. Clique em "Sortear Grupos" para refazer o sorteio.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum participante cadastrado.</p>
            <p className="text-sm">Importe uma planilha do Google Forms para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {(() => {
            const grouped = new Map<string, Player[]>();
            const ungrouped: Player[] = [];
            players.forEach(p => {
              if (p.grupo) {
                const list = grouped.get(p.grupo) || [];
                list.push(p);
                grouped.set(p.grupo, list);
              } else {
                ungrouped.push(p);
              }
            });
            const sortedGroups = [...grouped.keys()].sort((a, b) => Number(a) - Number(b));

            const renderTable = (list: Player[]) => (
              <div className="rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Nick</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Horários</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.nome_completo}
                          {p.eliminado && <Badge variant="destructive" className="ml-2">Eliminado por W.O</Badge>}
                        </TableCell>
                        <TableCell>{p.nick_playroom || "—"}</TableCell>
                        <TableCell>{p.whatsapp || "—"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{p.preferencia_horarios || "—"}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" aria-label={`Opções de ${p.nome_completo}`}>
                                Opções <MoreHorizontal className="h-4 w-4 ml-1" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-popover z-50">
                              <DropdownMenuItem onClick={() => openEdit(p)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onScheduleMatch?.(p.id)}>
                                <CalendarPlus className="h-4 w-4 mr-2" /> Agendar partida
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleEliminado(p)}>
                                {p.eliminado ? (
                                  <><RotateCcw className="h-4 w-4 mr-2" /> Reverter eliminação</>
                                ) : (
                                  <><Ban className="h-4 w-4 mr-2" /> Marcar como eliminado por W.O</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeletePlayer(p)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" /> Remover
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );

            return (
              <>
                {sortedGroups.map(g => (
                  <div key={g}>
                    <h2 className="text-xl font-bold mb-3">Grupo {g}</h2>
                    {renderTable(grouped.get(g)!)}
                  </div>
                ))}
                {ungrouped.length > 0 && (
                  <div>
                    {sortedGroups.length > 0 && <h2 className="text-xl font-bold mb-3">Sem grupo</h2>}
                    {renderTable(ungrouped)}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editPlayer} onOpenChange={(open) => !open && setEditPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-nome">Nome completo</Label>
              <Input id="edit-nome" value={editNome} onChange={e => setEditNome(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-nick">Nick no Playroom</Label>
              <Input id="edit-nick" value={editNick} onChange={e => setEditNick(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-whats">WhatsApp</Label>
              <Input id="edit-whats" value={editWhats} onChange={e => setEditWhats(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-horarios">Preferência de horários</Label>
              <Input id="edit-horarios" value={editHorarios} onChange={e => setEditHorarios(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="edit-grupo">Grupo</Label>
              <Input id="edit-grupo" value={editGrupo} onChange={e => setEditGrupo(e.target.value)} placeholder="Ex: 1, 2, 3..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPlayer(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>{savingEdit ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletePlayer} onOpenChange={(open) => !open && setDeletePlayer(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{deletePlayer?.nome_completo}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
