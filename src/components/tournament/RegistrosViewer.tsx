import { useEffect, useMemo, useState } from "react";
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

interface PlayerEditForm {
  result_id: string;
  player_id: string;
  pontos_jogo: string;
  pontos_mesa: string;
  penalidade_tipo: string;
  penalidade_outra: string;
}

interface Confronto {
  key: string;
  fase: string;
  grupo: string;
  rodada: number;
  registered_by: string | null;
  created_at: string;
  results: MatchResult[]; // 1 ou 2
}

const CONFRONTO_WINDOW_MS = 5 * 60 * 1000; // 5 minutos: registros do mesmo confronto criados juntos

export default function RegistrosViewer({ tournamentId, open, onOpenChange }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Confronto | null>(null);
  const [deleting, setDeleting] = useState<Confronto | null>(null);
  const [editFase, setEditFase] = useState("Fase de Grupos");
  const [editGrupo, setEditGrupo] = useState("");
  const [editRodada, setEditRodada] = useState("");
  const [editPlayers, setEditPlayers] = useState<PlayerEditForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [filterRound, setFilterRound] = useState<string>("all");

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

  // Agrupa registros em confrontos por fase/grupo/rodada/registered_by + janela de tempo
  const confrontos = useMemo<Confronto[]>(() => {
    // ordenar por created_at desc já vem do load
    const sorted = [...results];
    const groups: Confronto[] = [];
    // bucket por fase|grupo|rodada|registered_by
    const buckets = new Map<string, MatchResult[]>();
    for (const r of sorted) {
      const k = `${r.fase}||${r.grupo}||${r.rodada}||${r.registered_by ?? "null"}`;
      const arr = buckets.get(k) || [];
      arr.push(r);
      buckets.set(k, arr);
    }
    for (const arr of buckets.values()) {
      // dentro do bucket, agrupar pares por proximidade de created_at
      const used = new Set<string>();
      // ordena cronologicamente para parear
      const chrono = [...arr].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      for (let i = 0; i < chrono.length; i++) {
        const a = chrono[i];
        if (used.has(a.id)) continue;
        // procura próximo não usado, jogador diferente, dentro da janela
        let pair: MatchResult | null = null;
        for (let j = i + 1; j < chrono.length; j++) {
          const b = chrono[j];
          if (used.has(b.id)) continue;
          if (b.player_id === a.player_id) continue;
          const dt = Math.abs(+new Date(b.created_at) - +new Date(a.created_at));
          if (dt <= CONFRONTO_WINDOW_MS) { pair = b; break; }
          break; // ordenado: se o próximo já passou da janela, não há par
        }
        const items = pair ? [a, pair] : [a];
        items.forEach(it => used.add(it.id));
        groups.push({
          key: items.map(i => i.id).join("|"),
          fase: a.fase,
          grupo: a.grupo,
          rodada: a.rodada,
          registered_by: a.registered_by,
          created_at: items.map(i => i.created_at).sort().slice(-1)[0],
          results: items,
        });
      }
    }
    // ordenar resultado final por created_at desc
    groups.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    return groups;
  }, [results]);

  const confrontoTitle = (c: Confronto) => {
    if (c.results.length === 2) {
      return `${playerName(c.results[0].player_id)} × ${playerName(c.results[1].player_id)}`;
    }
    return `${playerName(c.results[0].player_id)} (registro avulso)`;
  };

  const openEdit = (c: Confronto) => {
    setEditing(c);
    setEditFase(c.fase || "Fase de Grupos");
    setEditGrupo(c.grupo || "");
    setEditRodada(String(c.rodada));
    setEditPlayers(
      c.results.map(r => {
        const isKnown = (PENALIDADE_OPCOES as readonly string[]).includes(r.penalidades);
        return {
          result_id: r.id,
          player_id: r.player_id,
          pontos_jogo: String(r.pontos_jogo),
          pontos_mesa: String(r.pontos_mesa),
          penalidade_tipo: isKnown ? r.penalidades : "Outra",
          penalidade_outra: isKnown ? "" : r.penalidades,
        };
      })
    );
  };

  const updatePlayerField = (idx: number, field: keyof PlayerEditForm, value: string) => {
    setEditPlayers(prev => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editRodada) { toast.error("Informe a rodada"); return; }
    const isFaseDeGrupos = editFase === "Fase de Grupos";
    if (isFaseDeGrupos && !editGrupo.trim()) { toast.error("Informe o grupo"); return; }
    if (editPlayers.some(p => !p.pontos_jogo || !p.pontos_mesa)) {
      toast.error("Preencha pontos de todos os jogadores"); return;
    }
    if (editPlayers.some(p => p.penalidade_tipo === "Outra" && !p.penalidade_outra.trim())) {
      toast.error("Especifique a penalidade 'Outra'"); return;
    }

    setSaving(true);
    const updates = editPlayers.map(p => {
      const penalidades =
        p.penalidade_tipo === "Outra"
          ? p.penalidade_outra.trim() || "Outra"
          : p.penalidade_tipo;
      return supabase
        .from("match_results")
        .update({
          fase: editFase,
          grupo: isFaseDeGrupos ? editGrupo.trim() : editFase,
          rodada: parseInt(editRodada),
          pontos_jogo: parseInt(p.pontos_jogo),
          pontos_mesa: parseInt(p.pontos_mesa),
          penalidades,
        })
        .eq("id", p.result_id);
    });
    const responses = await Promise.all(updates);
    setSaving(false);
    if (responses.some(r => r.error)) {
      toast.error("Erro ao atualizar um ou mais registros do confronto");
      return;
    }
    toast.success("Confronto atualizado");
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    const ids = deleting.results.map(r => r.id);
    const { error } = await supabase.from("match_results").delete().in("id", ids);
    if (error) {
      toast.error("Erro ao apagar confronto");
      return;
    }
    toast.success(ids.length > 1 ? "Confronto apagado" : "Registro apagado");
    setDeleting(null);
    load();
  };

  const isFaseDeGruposEdit = editFase === "Fase de Grupos";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registros de confrontos</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin opacity-50" />
            </div>
          ) : confrontos.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <ul className="space-y-2">
              {confrontos.map(c => (
                <li key={c.key} className="p-3 border rounded-md bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="font-medium">{confrontoTitle(c)}</div>
                    <div className="text-muted-foreground text-xs">
                      {c.fase} · {c.fase === "Fase de Grupos" ? `Grupo ${c.grupo} · ` : ""}Rodada {c.rodada}
                    </div>
                    <ul className="text-xs mt-1 space-y-0.5">
                      {c.results.map(r => (
                        <li key={r.id}>
                          <span className="font-medium">{playerName(r.player_id)}:</span>{" "}
                          Vitória {r.pontos_jogo} · Mesa {r.pontos_mesa} · Penalidade: {r.penalidades}
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-muted-foreground mt-1">
                      Registrado por: {registeredByName(c.registered_by)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(c)} aria-label={`Editar confronto ${confrontoTitle(c)}`}>
                      <Pencil className="h-4 w-4 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleting(c)} aria-label={`Apagar confronto ${confrontoTitle(c)}`}>
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
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar confronto</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{confrontoTitle(editing)}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-fase">Fase</Label>
                  <Select value={editFase} onValueChange={setEditFase}>
                    <SelectTrigger id="edit-fase"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FASES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-rodada">Rodada</Label>
                  <Input id="edit-rodada" type="number" min={1} value={editRodada} onChange={e => setEditRodada(e.target.value)} />
                </div>
              </div>
              {isFaseDeGruposEdit && (
                <div className="space-y-2">
                  <Label htmlFor="edit-grupo">Grupo</Label>
                  <Input id="edit-grupo" value={editGrupo} onChange={e => setEditGrupo(e.target.value)} placeholder="Ex: 1" />
                </div>
              )}

              {editPlayers.map((p, idx) => (
                <div key={p.result_id} className="p-3 border rounded-md space-y-3 bg-muted/30">
                  <p className="text-sm font-medium">{playerName(p.player_id)}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`edit-pj-${idx}`}>Pontos de Vitória</Label>
                      <Input id={`edit-pj-${idx}`} type="number" min={0} value={p.pontos_jogo} onChange={e => updatePlayerField(idx, "pontos_jogo", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`edit-pm-${idx}`}>Pontos de Mesa</Label>
                      <Input id={`edit-pm-${idx}`} type="number" min={0} value={p.pontos_mesa} onChange={e => updatePlayerField(idx, "pontos_mesa", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`edit-pen-${idx}`}>Penalidades</Label>
                    <Select value={p.penalidade_tipo} onValueChange={v => updatePlayerField(idx, "penalidade_tipo", v)}>
                      <SelectTrigger id={`edit-pen-${idx}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PENALIDADE_OPCOES.map(op => <SelectItem key={op} value={op}>{op}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {p.penalidade_tipo === "Outra" && (
                      <Input
                        className="mt-2"
                        value={p.penalidade_outra}
                        onChange={e => updatePlayerField(idx, "penalidade_outra", e.target.value)}
                        placeholder="Especifique a penalidade"
                      />
                    )}
                  </div>
                </div>
              ))}
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
            <AlertDialogTitle>Apagar confronto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && (
                deleting.results.length > 1
                  ? `Esta ação removerá os registros de ${confrontoTitle(deleting)} (Rodada ${deleting.rodada}). Não pode ser desfeita.`
                  : `Esta ação removerá o registro de ${playerName(deleting.results[0].player_id)} (Rodada ${deleting.rodada}). Não pode ser desfeita.`
              )}
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
