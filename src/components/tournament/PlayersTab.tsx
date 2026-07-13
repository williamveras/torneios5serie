import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Upload, Trash2, Users, Shuffle, Lightbulb, MoreHorizontal, Pencil, CalendarPlus, Ban, RotateCcw, Plus, Crown, Clock, X, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;
type TeamMember = { id?: string; team_id?: string; member_nome: string; member_nick: string | null; member_email: string | null; member_whatsapp: string | null; position: number; is_captain?: boolean };

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
  const { user } = useAuth();
  const [players, setPlayers] = useState<Player[]>([]);
  const [modalidade, setModalidade] = useState<"individual" | "duplas">("individual");
  const [teamMembersMap, setTeamMembersMap] = useState<Record<string, TeamMember[]>>({});
  const [perGroup, setPerGroup] = useState<string>("4");
  const [sorting, setSorting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Scheduled group draw
  const [groupDrawDate, setGroupDrawDate] = useState("");
  const [groupDrawTime, setGroupDrawTime] = useState("");
  const [schedulingGroupDraw, setSchedulingGroupDraw] = useState(false);
  const [pendingGroupDraws, setPendingGroupDraws] = useState<Array<{ id: string; scheduled_at: string; per_group: number | null }>>([]);

  // Edit dialog state
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editNick, setEditNick] = useState("");
  const [editWhats, setEditWhats] = useState("");
  const [editHorarios, setEditHorarios] = useState("");
  const [editGrupo, setEditGrupo] = useState("");
  const [editMembers, setEditMembers] = useState<TeamMember[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Team create dialog
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const emptyMember = (pos: number): TeamMember => ({ member_nome: "", member_nick: "", member_email: "", member_whatsapp: "", position: pos, is_captain: pos === 1 });
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamGrupo, setNewTeamGrupo] = useState("");
  const [newTeamMembers, setNewTeamMembers] = useState<TeamMember[]>([emptyMember(1), emptyMember(2)]);
  const [savingTeam, setSavingTeam] = useState(false);

  // Delete confirmation
  const [deletePlayer, setDeletePlayer] = useState<Player | null>(null);

  // Export dialog
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "txt">("xlsx");
  const [exportFields, setExportFields] = useState<Record<string, boolean>>({});


  const fetchPlayers = async () => {
    const [{ data: tour }, { data: pls }] = await Promise.all([
      (supabase.from("tournaments") as any).select("modalidade").eq("id", tournamentId).maybeSingle(),
      supabase.from("players").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: true }),
    ]);
    setModalidade(((tour as any)?.modalidade ?? "individual") as "individual" | "duplas");
    if (pls) setPlayers(pls);
    const teamIds = (pls || []).filter((p: any) => p.is_team).map((p: any) => p.id);
    if (teamIds.length > 0) {
      const { data: members } = await (supabase.from("team_members") as any)
        .select("*")
        .in("team_id", teamIds);
      const map: Record<string, TeamMember[]> = {};
      (members || []).forEach((m: TeamMember) => {
        const tid = m.team_id!;
        if (!map[tid]) map[tid] = [];
        map[tid].push(m);
      });
      Object.values(map).forEach(arr => arr.sort((a, b) => a.position - b.position));
      setTeamMembersMap(map);
    } else {
      setTeamMembersMap({});
    }
  };

  useEffect(() => { fetchPlayers(); fetchPendingGroupDraws(); }, [tournamentId]);

  async function fetchPendingGroupDraws() {
    const { data } = await (supabase.from("scheduled_draws") as any)
      .select("id,scheduled_at,per_group,status,kind")
      .eq("tournament_id", tournamentId)
      .eq("kind", "grupos")
      .eq("status", "pending")
      .order("scheduled_at", { ascending: true });
    setPendingGroupDraws((data || []) as any);
  }

  async function scheduleGroupDraw() {
    const size = parseInt(perGroup);
    if (!size || size < 2) { toast.error("Informe pelo menos 2 jogadores por grupo"); return; }
    if (!groupDrawDate || !groupDrawTime) { toast.error("Informe data e horário para o sorteio."); return; }
    const [y, m, d] = groupDrawDate.split("-").map(Number);
    const [hh, mm] = groupDrawTime.split(":").map(Number);
    const when = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    if (isNaN(when.getTime())) { toast.error("Data ou horário inválido."); return; }
    if (when.getTime() <= Date.now()) { toast.error("O horário deve ser no futuro."); return; }
    setSchedulingGroupDraw(true);
    const { error } = await (supabase.from("scheduled_draws") as any).insert({
      tournament_id: tournamentId,
      fase: "Fase de Grupos",
      mode: "por_grupo",
      kind: "grupos",
      per_group: size,
      scheduled_at: when.toISOString(),
      created_by: user?.id ?? null,
    });
    setSchedulingGroupDraw(false);
    if (error) { toast.error("Erro ao agendar: " + error.message); return; }
    toast.success("Sorteio dos grupos agendado!");
    setGroupDrawDate(""); setGroupDrawTime("");
    fetchPendingGroupDraws();
  }

  async function cancelGroupDraw(id: string) {
    const { error } = await (supabase.from("scheduled_draws") as any)
      .update({ status: "cancelled" }).eq("id", id);
    if (error) toast.error("Erro ao cancelar: " + error.message);
    else { toast.success("Sorteio cancelado."); fetchPendingGroupDraws(); }
  }

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
      if (String(error.message || "").includes("max_participants_reached")) {
        toast.error("Limite de participantes atingido", { description: "Aumente o limite nas configurações do torneio para importar mais." });
      } else {
        toast.error("Erro ao importar jogadores");
      }
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
    if ((p as any).is_team) {
      const existing = teamMembersMap[p.id] || [];
      const m1 = existing.find(m => m.position === 1) || emptyMember(1);
      const m2 = existing.find(m => m.position === 2) || emptyMember(2);
      setEditMembers([m1, m2]);
    } else {
      setEditMembers([]);
    }
  };

  const handleSaveEdit = async () => {
    if (!editPlayer) return;
    if (!editNome.trim()) { toast.error("Nome é obrigatório"); return; }
    const isTeam = (editPlayer as any).is_team;
    if (isTeam) {
      if (!editMembers[0]?.member_nome.trim() || !editMembers[1]?.member_nome.trim()) {
        toast.error("Informe o nome dos dois jogadores da dupla");
        return;
      }
    }
    setSavingEdit(true);
    const { error } = await supabase.from("players").update({
      nome_completo: editNome.trim(),
      nick_playroom: editNick.trim() || null,
      whatsapp: editWhats.trim() || null,
      preferencia_horarios: editHorarios.trim() || null,
      grupo: editGrupo.trim() || null,
    }).eq("id", editPlayer.id);
    if (error) {
      setSavingEdit(false);
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    if (isTeam) {
      // upsert members: delete + insert is simplest and safe (cascades not needed)
      await (supabase.from("team_members") as any).delete().eq("team_id", editPlayer.id);
      const rows = editMembers.map(m => ({
        team_id: editPlayer.id,
        member_nome: m.member_nome.trim(),
        member_nick: m.member_nick?.trim() || null,
        member_email: m.member_email?.trim() || null,
        member_whatsapp: m.member_whatsapp?.trim() || null,
        position: m.position,
        is_captain: !!m.is_captain,
      }));
      const { error: memErr } = await (supabase.from("team_members") as any).insert(rows);
      if (memErr) {
        setSavingEdit(false);
        toast.error("Erro ao salvar jogadores da dupla: " + memErr.message);
        return;
      }
    }
    setSavingEdit(false);
    toast.success(isTeam ? "Dupla atualizada" : "Jogador atualizado");
    setEditPlayer(null);
    fetchPlayers();
  };

  const handleCreateTeam = async () => {
    const m1 = newTeamMembers[0];
    const m2 = newTeamMembers[1];
    if (!m1.member_nome.trim() || !m2.member_nome.trim()) {
      toast.error("Informe o nome dos dois jogadores da dupla"); return;
    }
    const defaultName = [m1.member_nick?.trim() || m1.member_nome.trim(), m2.member_nick?.trim() || m2.member_nome.trim()].join(" & ");
    const nome = newTeamName.trim() || defaultName;
    const nick = [m1.member_nick?.trim(), m2.member_nick?.trim()].filter(Boolean).join(" / ") || null;
    setSavingTeam(true);
    const { data: team, error } = await (supabase.from("players") as any).insert({
      tournament_id: tournamentId,
      nome_completo: nome,
      nick_playroom: nick,
      grupo: newTeamGrupo.trim() || null,
      is_team: true,
    }).select("id").single();
    if (error || !team) {
      setSavingTeam(false);
      const msg = String(error?.message ?? "");
      if (msg.includes("max_participants_reached")) {
        toast.error("Limite de participantes atingido", { description: "Aumente o limite nas configurações do torneio para cadastrar mais duplas." });
      } else {
        toast.error("Erro ao criar dupla: " + msg);
      }
      return;
    }
    const rows = newTeamMembers.map(m => ({
      team_id: team.id,
      member_nome: m.member_nome.trim(),
      member_nick: m.member_nick?.trim() || null,
      member_email: m.member_email?.trim() || null,
      member_whatsapp: m.member_whatsapp?.trim() || null,
      position: m.position,
      is_captain: !!m.is_captain,
    }));
    const { error: memErr } = await (supabase.from("team_members") as any).insert(rows);
    setSavingTeam(false);
    if (memErr) { toast.error("Dupla criada, mas erro ao salvar jogadores: " + memErr.message); }
    else { toast.success("Dupla cadastrada"); }
    setNewTeamName(""); setNewTeamGrupo("");
    setNewTeamMembers([emptyMember(1), emptyMember(2)]);
    setTeamDialogOpen(false);
    fetchPlayers();
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

  type ExportField = { key: string; label: string; get: (p: Player) => string };

  const getExportFields = (): ExportField[] => {
    if (modalidade === "duplas") {
      const memberField = (pos: number, attr: "member_nome" | "member_nick" | "member_email" | "member_whatsapp") =>
        (p: Player) => {
          const members = teamMembersMap[p.id] || [];
          const m = members.find(mm => mm.position === pos);
          return (m?.[attr] as string) || "";
        };
      return [
        { key: "team_name", label: "Nome da equipe", get: (p) => p.nome_completo || "" },
        { key: "grupo", label: "Grupo", get: (p) => p.grupo || "" },
        { key: "m1_nick", label: "Nick jogador 1", get: memberField(1, "member_nick") },
        { key: "m1_nome", label: "Nome jogador 1", get: memberField(1, "member_nome") },
        { key: "m1_whats", label: "WhatsApp jogador 1", get: memberField(1, "member_whatsapp") },
        { key: "m1_email", label: "E-mail jogador 1", get: memberField(1, "member_email") },
        { key: "m2_nick", label: "Nick jogador 2", get: memberField(2, "member_nick") },
        { key: "m2_nome", label: "Nome jogador 2", get: memberField(2, "member_nome") },
        { key: "m2_whats", label: "WhatsApp jogador 2", get: memberField(2, "member_whatsapp") },
        { key: "m2_email", label: "E-mail jogador 2", get: memberField(2, "member_email") },
      ];
    }
    return [
      { key: "nick", label: "Nick no Playroom", get: (p) => p.nick_playroom || "" },
      { key: "nome", label: "Nome completo", get: (p) => p.nome_completo || "" },
      { key: "whatsapp", label: "WhatsApp", get: (p) => p.whatsapp || "" },
      { key: "grupo", label: "Grupo", get: (p) => p.grupo || "" },
      { key: "horarios", label: "Preferência de horários", get: (p) => p.preferencia_horarios || "" },
      { key: "comentario", label: "Comentário", get: (p) => p.comentario || "" },
    ];
  };

  const openExportDialog = (format: "xlsx" | "txt") => {
    if (players.length === 0) { toast.info("Nenhum participante para exportar"); return; }
    setExportFormat(format);
    const fields = getExportFields();
    // Default: first field selected only (nick / nome da equipe)
    const initial: Record<string, boolean> = {};
    fields.forEach((f, i) => { initial[f.key] = i === 0 || (modalidade === "duplas" && (f.key === "m1_nick" || f.key === "m2_nick")); });
    setExportFields(initial);
    setExportOpen(true);
  };

  const safeName = (tournamentId || "torneio").slice(0, 8);

  const runExport = () => {
    const fields = getExportFields().filter(f => exportFields[f.key]);
    if (fields.length === 0) { toast.error("Selecione ao menos um campo"); return; }

    if (exportFormat === "xlsx") {
      const rows = players.map((p) => {
        const row: Record<string, string> = {};
        fields.forEach(f => { row[f.label] = f.get(p); });
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Participantes");
      XLSX.writeFile(wb, `participantes-${safeName}.xlsx`);
    } else {
      const content = players.map((p) => {
        return fields.map(f => f.get(p)).filter(v => v !== "").join(" — ");
      }).filter(Boolean).join("\n");
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `participantes-${safeName}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExportOpen(false);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          {players.length} {modalidade === "duplas" ? "dupla(s)" : "participante(s)"}
        </p>
        <div className="flex items-center gap-2">
          {modalidade === "duplas" && (
            <Button onClick={() => setTeamDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar Dupla
            </Button>
          )}
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importar Planilha
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={players.length === 0}>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportXlsx}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Planilha (.xlsx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportTxt}>
                <FileText className="h-4 w-4 mr-2" /> Texto (.txt)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

            {/* Agendar sorteio automático dos grupos */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Agendar sorteio automático dos grupos</p>
              </div>
              <p className="text-xs text-muted-foreground">
                O sistema distribuirá os participantes não eliminados em grupos automaticamente na data e horário informados, usando a quantidade definida em "Jogadores por grupo".
              </p>
              <div className="flex flex-wrap gap-2 items-end">
                <div>
                  <Label htmlFor="group-draw-date" className="text-xs">Data</Label>
                  <Input id="group-draw-date" type="date" value={groupDrawDate} onChange={(e) => setGroupDrawDate(e.target.value)} className="w-40" />
                </div>
                <div>
                  <Label htmlFor="group-draw-time" className="text-xs">Horário</Label>
                  <Input id="group-draw-time" type="time" value={groupDrawTime} onChange={(e) => setGroupDrawTime(e.target.value)} className="w-32" />
                </div>
                <Button variant="secondary" size="sm" onClick={scheduleGroupDraw} disabled={schedulingGroupDraw}>
                  <Clock className="h-4 w-4 mr-1" /> {schedulingGroupDraw ? "Agendando..." : "Agendar sorteio"}
                </Button>
              </div>
              {pendingGroupDraws.length > 0 && (
                <div className="space-y-1 pt-2">
                  <p className="text-xs font-medium">Sorteios agendados</p>
                  {pendingGroupDraws.map((s) => {
                    const dt = new Date(s.scheduled_at);
                    return (
                      <div key={s.id} className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                        <span>
                          {dt.toLocaleDateString("pt-BR")} às {dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {s.per_group ? ` · ${s.per_group} por grupo` : ""}
                        </span>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => cancelGroupDraw(s.id)} aria-label="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
                    {list.map(p => {
                      const isTeam = (p as any).is_team;
                      const members = teamMembersMap[p.id] || [];
                      return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.nome_completo}
                          {isTeam && (
                            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                              <Users className="h-3 w-3" /> Dupla
                            </span>
                          )}
                          {p.eliminado && <Badge variant="destructive" className="ml-2">Eliminado por W.O</Badge>}
                          {isTeam && members.length > 0 && (() => {
                            const captain = members.find(m => m.is_captain);
                            return (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <div>
                                  {members.map(m => (
                                    <span key={m.position}>
                                      {m.member_nome}
                                      {m.is_captain && (
                                        <Crown className="inline h-3 w-3 ml-1 -mt-0.5 text-amber-500" aria-label="Capitão" />
                                      )}
                                      {m.position === 1 ? " & " : ""}
                                    </span>
                                  ))}
                                </div>
                                {captain && (
                                  <div className="text-foreground/80">
                                    <span className="font-medium">Capitão:</span> {captain.member_nome}
                                    {captain.member_email ? ` • ${captain.member_email}` : ""}
                                    {captain.member_whatsapp ? ` • ${captain.member_whatsapp}` : ""}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          {isTeam
                            ? (members.map(m => m.member_nick).filter(Boolean).join(" / ") || p.nick_playroom || "—")
                            : (p.nick_playroom || "—")}
                        </TableCell>
                        <TableCell>
                          {isTeam
                            ? (() => {
                                const cap = members.find(m => m.is_captain);
                                return cap?.member_whatsapp || members.map(m => m.member_whatsapp).filter(Boolean).join(" / ") || "—";
                              })()
                            : (p.whatsapp || "—")}
                        </TableCell>
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
                      );
                    })}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editPlayer as any)?.is_team ? "Editar Dupla" : "Editar Participante"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="edit-nome">{(editPlayer as any)?.is_team ? "Nome da dupla" : "Nome completo"}</Label>
              <Input id="edit-nome" value={editNome} onChange={e => setEditNome(e.target.value)} />
            </div>
            {!(editPlayer as any)?.is_team && (
              <>
                <div>
                  <Label htmlFor="edit-nick">Nick no Playroom</Label>
                  <Input id="edit-nick" value={editNick} onChange={e => setEditNick(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="edit-whats">WhatsApp</Label>
                  <Input id="edit-whats" value={editWhats} onChange={e => setEditWhats(e.target.value)} />
                </div>
              </>
            )}
            {(editPlayer as any)?.is_team && editMembers.map((m, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Jogador {m.position}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={m.is_captain ? "default" : "outline"}
                    onClick={() => setEditMembers(prev => prev.map((x, i) => ({ ...x, is_captain: i === idx })))}
                  >
                    <Crown className="h-3.5 w-3.5 mr-1" />
                    {m.is_captain ? "Capitão" : "Definir capitão"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome</Label>
                    <Input value={m.member_nome} onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_nome: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nick no Playroom</Label>
                    <Input value={m.member_nick ?? ""} onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_nick: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={m.member_whatsapp ?? ""} onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_whatsapp: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={m.member_email ?? ""} onChange={e => setEditMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_email: e.target.value } : x))} />
                  </div>
                </div>
              </div>
            ))}
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

      {/* Add Team Dialog */}
      <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Dupla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da dupla (opcional)</Label>
              <Input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="Deixe em branco para gerar a partir dos nicks/nomes"
              />
            </div>
            <div>
              <Label>Grupo (opcional)</Label>
              <Input value={newTeamGrupo} onChange={e => setNewTeamGrupo(e.target.value)} placeholder="Ex: 1, 2, 3..." />
            </div>
            {newTeamMembers.map((m, idx) => (
              <div key={idx} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">Jogador {m.position}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant={m.is_captain ? "default" : "outline"}
                    onClick={() => setNewTeamMembers(prev => prev.map((x, i) => ({ ...x, is_captain: i === idx })))}
                  >
                    <Crown className="h-3.5 w-3.5 mr-1" />
                    {m.is_captain ? "Capitão" : "Definir capitão"}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nome *</Label>
                    <Input value={m.member_nome} onChange={e => setNewTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_nome: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nick no Playroom</Label>
                    <Input value={m.member_nick ?? ""} onChange={e => setNewTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_nick: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">WhatsApp</Label>
                    <Input value={m.member_whatsapp ?? ""} onChange={e => setNewTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_whatsapp: e.target.value } : x))} />
                  </div>
                  <div>
                    <Label className="text-xs">Email</Label>
                    <Input value={m.member_email ?? ""} onChange={e => setNewTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, member_email: e.target.value } : x))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateTeam} disabled={savingTeam}>{savingTeam ? "Salvando..." : "Criar dupla"}</Button>
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
