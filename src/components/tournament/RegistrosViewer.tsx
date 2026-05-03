import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;
type Profile = Tables<"profiles">;

const PENALIDADE_OPCOES = ["Sem penalidades", "W.O", "Digitação na mesa", "Outra"] as const;

interface Props {
  tournamentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RegistrosViewer({ tournamentId, open, onOpenChange }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MatchResult | null>(null);
  const [deleting, setDeleting] = useState<MatchResult | null>(null);
  const [editForm, setEditForm] = useState({
    fase: "Fase de Grupos",
    grupo: "",
    rodada: "",
    pontos_jogo: "",
    pontos_mesa: "",
    penalidade_tipo: "Sem penalidades",
    penalidade_outra: "",
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: rs }, { data: ps }, { data: prs }] = await Promise.all([
      supabase.from("match_results").select("*").eq("tournament_id", tournamentId).order("created_at", { ascending: false }),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("profiles").select("*"),
    ]);
    setResults(rs || []);
    setPlayers(Object.fromEntries((ps || []).map(p => [p.id, p])));
    setProfiles(Object.fromEntries((prs || []).map(p => [p.user_id, p])));
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, tournamentId]);

  const playerName = (id: string) => {
    const p = players[id];
    if (!p) return "Jogador desconhecido";
    return p.nick_playroom || p.nome_completo;
  };

  const registeredByName = (uid: string | null) => {
    if (!uid) return "Não informado";
    return profiles[uid]?.nome || "Usuário desconhecido";
  };

  const openEdit = (r: MatchResult) => {
    const isKnownPenalty = (PENALIDADE_OPCOES as readonly string[]).includes(r.penalidades);
    setEditing(r);
    setEditForm({
      fase: r.fase || "Fase de Grupos",
      grupo: r.grupo || "",
      rodada: String(r.rodada),
      pontos_jogo: String(r.pontos_jogo),
      pontos_mesa: String(r.pontos_mesa),
      penalidade_tipo: isKnownPenalty ? r.penalidades : "Outra",
      penalidade_outra: isKnownPenalty ? "" : r.penalidades,
    });
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editForm.rodada || !editForm.pontos_jogo || !editForm.pontos_mesa) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    const isFaseDeGrupos = editForm.fase === "Fase de Grupos";
    if (isFaseDeGrupos && !editForm.grupo.trim()) {
      toast.error("Informe o grupo");
      return;
    }
    const penalidades =
      editForm.penalidade_tipo === "Outra"
        ? editForm.penalidade_outra.trim() || "Outra"
        : editForm.penalidade_tipo;

    setSaving(true);
    const { error } = await supabase
      .from("match_results")
      .update({
        fase: editForm.fase,
        grupo: isFaseDeGrupos ? editForm.grupo.trim() : editForm.fase,
        rodada: parseInt(editForm.rodada),
        pontos_jogo: parseInt(editForm.pontos_jogo),
        pontos_mesa: parseInt(editForm.pontos_mesa),
        penalidades,
      })
      .eq("id", editing.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao atualizar registro");
      return;
    }
    toast.success("Registro atualizado");
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("match_results").delete().eq("id", deleting.id);
    if (error) {
      toast.error("Erro ao apagar registro");
      return;
    }
    toast.success("Registro apagado");
    setDeleting(null);
    load();
  };

  const isFaseDeGruposEdit = editForm.fase === "Fase de Grupos";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registros de resultados</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin opacity-50" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-2">
              {results.map(r => (
                <li key={r.id} className="p-3 border rounded-md bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium">{playerName(r.player_id)}</div>
                    <div className="text-muted-foreground text-xs">
                      {r.fase} · {r.fase === "Fase de Grupos" ? `Grupo ${r.grupo} · ` : ""}Rodada {r.rodada}
                    </div>
                    <div className="text-xs">
                      Vitória: {r.pontos_jogo} · Mesa: {r.pontos_mesa} · Penalidade: {r.penalidades}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Registrado por: {registeredByName(r.registered_by)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(r)} aria-label={`Editar registro de ${playerName(r.player_id)}`}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleting(r)} aria-label={`Apagar registro de ${playerName(r.player_id)}`}>
                      <Trash2 className="h-4 w-4 mr-1" /> Apagar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar registro</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Jogador: <strong>{playerName(editing.player_id)}</strong></p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-fase">Fase</Label>
                  <Select value={editForm.fase} onValueChange={v => setEditForm(f => ({ ...f, fase: v }))}>
                    <SelectTrigger id="edit-fase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FASES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rodada">Rodada</Label>
                  <Input id="edit-rodada" type="number" min={1} value={editForm.rodada} onChange={e => setEditForm(f => ({ ...f, rodada: e.target.value }))} />
                </div>
              </div>
              {isFaseDeGruposEdit && (
                <div className="space-y-2">
                  <Label htmlFor="edit-grupo">Grupo</Label>
                  <Input id="edit-grupo" value={editForm.grupo} onChange={e => setEditForm(f => ({ ...f, grupo: e.target.value }))} placeholder="Ex: 1" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-pj">Pontos de Vitória</Label>
                  <Input id="edit-pj" type="number" min={0} value={editForm.pontos_jogo} onChange={e => setEditForm(f => ({ ...f, pontos_jogo: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-pm">Pontos de Mesa</Label>
                  <Input id="edit-pm" type="number" min={0} value={editForm.pontos_mesa} onChange={e => setEditForm(f => ({ ...f, pontos_mesa: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-pen">Penalidades</Label>
                <Select value={editForm.penalidade_tipo} onValueChange={v => setEditForm(f => ({ ...f, penalidade_tipo: v }))}>
                  <SelectTrigger id="edit-pen"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PENALIDADE_OPCOES.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                  </SelectContent>
                </Select>
                {editForm.penalidade_tipo === "Outra" && (
                  <Input
                    className="mt-2"
                    value={editForm.penalidade_outra}
                    onChange={e => setEditForm(f => ({ ...f, penalidade_outra: e.target.value }))}
                    placeholder="Especifique a penalidade"
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar registro?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `Esta ação removerá o registro de ${playerName(deleting.player_id)} (Rodada ${deleting.rodada}). Não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Apagar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
