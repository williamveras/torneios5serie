import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Trash2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { FASES } from "@/lib/constants";
import { getActivePublicPhase, isGroupPhase, buildMesaMap, pairKey } from "@/lib/phase";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;
type Profile = Tables<"profiles">;
type Matchup = Tables<"matchups">;
type PhaseStatus = Tables<"phase_status">;

const PENALIDADE_OPCOES = ["Sem penalidades", "W.O", "Eliminado por W.O", "Digitação na mesa", "Outra"] as const;
const TZ = "America/Sao_Paulo";
const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

const brasiliaParts = (d: Date) => {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
};
const brasiliaWeekday = (d: Date) => {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[fmt.format(d)] ?? 0;
};
const formatTime = (d: Date) => { const p = brasiliaParts(d); return `${p.hour}:${p.minute}`; };
const formatDayKey = (d: Date) => { const p = brasiliaParts(d); return `${p.year}-${p.month}-${p.day}`; };
const formatDayLabel = (d: Date) => {
  const p = brasiliaParts(d);
  return `Jogos de ${WEEKDAYS[brasiliaWeekday(d)]} (${p.day}/${p.month})`;
};

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
  results: MatchResult[];
}

export default function RegistrosViewer({ tournamentId, open, onOpenChange }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [matchups, setMatchups] = useState<Matchup[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<PhaseStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Confronto | null>(null);
  const [deleting, setDeleting] = useState<Confronto | null>(null);
  const [editFase, setEditFase] = useState("Fase de Grupos");
  const [editGrupo, setEditGrupo] = useState("");
  const [editRodada, setEditRodada] = useState("");
  const [editPlayers, setEditPlayers] = useState<PlayerEditForm[]>([]);
  const [saving, setSaving] = useState(false);
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");
  const [filterPenalidade, setFilterPenalidade] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const [rs, { data: ps }, { data: prs }, { data: mus }, { data: phs }] = await Promise.all([
      fetchAllMatchResults(tournamentId),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("profiles").select("*"),
      supabase.from("matchups").select("*").eq("tournament_id", tournamentId),
      supabase.from("phase_status").select("*").eq("tournament_id", tournamentId),
    ]);
    setResults(rs || []);
    setPlayers(Object.fromEntries((ps || []).map(p => [p.id, p])));
    setProfiles(Object.fromEntries((prs || []).map(p => [p.user_id, p])));
    setMatchups(mus || []);
    setPhaseStatuses(phs || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open) load();
  }, [open, tournamentId]);

  const activeFase = useMemo(() => getActivePublicPhase(phaseStatuses), [phaseStatuses]);
  useEffect(() => { setSelectedFase(activeFase); }, [activeFase]);

  const playerName = (id: string) => {
    const p = players[id];
    if (!p) return "Jogador desconhecido";
    return p.nick_playroom || p.nome_completo;
  };
  const registeredByName = (uid: string | null) => {
    if (!uid) return "Não informado";
    return profiles[uid]?.nome || "Usuário desconhecido";
  };

  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => r.fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const isFaseDeGrupos = isGroupPhase(selectedFase);
  const mesaMap = useMemo(() => buildMesaMap(matchups as any, selectedFase), [matchups, selectedFase]);

  // Group results into confrontos (by created_at + fase + grupo + rodada)
  const confrontos = useMemo<Confronto[]>(() => {
    const filtered = results.filter(r => (r.fase || "Fase de Grupos") === selectedFase);
    const map = new Map<string, Confronto>();
    for (const r of filtered) {
      const fase = r.fase || "Fase de Grupos";
      const key = `${r.created_at}|${fase}|${r.grupo}|${r.rodada}`;
      const existing = map.get(key);
      if (existing) existing.results.push(r);
      else map.set(key, {
        key, created_at: r.created_at, fase, grupo: r.grupo, rodada: r.rodada,
        registered_by: r.registered_by, results: [r],
      });
    }
    return Array.from(map.values()).sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [results, selectedFase]);

  const availablePenalidades = useMemo(() => {
    const set = new Set<string>();
    for (const c of confrontos) for (const r of c.results) set.add(r.penalidades);
    return [...set].sort();
  }, [confrontos]);

  const filteredConfrontos = useMemo(() => {
    if (filterPenalidade === "all") return confrontos;
    return confrontos.filter(c => c.results.some(r => r.penalidades === filterPenalidade));
  }, [confrontos, filterPenalidade]);

  const confrontoGroupKey = (c: Confronto): number => {
    if (isFaseDeGrupos) return c.rodada;
    if (c.results.length < 2) return 0;
    const mesa = mesaMap.get(pairKey(c.results[0].player_id, c.results[1].player_id));
    return mesa ?? 0;
  };
  const groupLabel = (n: number) => isFaseDeGrupos ? `Rodada ${n}` : (n > 0 ? `Mesa ${n}` : "Sem mesa");

  const rodadasGroups = useMemo(() => {
    const rodMap = new Map<number, Map<string, { key: string; date: Date; confrontos: Confronto[] }>>();
    for (const c of filteredConfrontos) {
      const d = new Date(c.created_at);
      const dayKey = formatDayKey(d);
      const gk = confrontoGroupKey(c);
      let dayMap = rodMap.get(gk);
      if (!dayMap) { dayMap = new Map(); rodMap.set(gk, dayMap); }
      const existing = dayMap.get(dayKey);
      if (existing) existing.confrontos.push(c);
      else dayMap.set(dayKey, { key: dayKey, date: d, confrontos: [c] });
    }
    return Array.from(rodMap.entries())
      .sort((a, b) => isFaseDeGrupos ? b[0] - a[0] : a[0] - b[0])
      .map(([rodada, dayMap]) => ({
        rodada,
        dias: Array.from(dayMap.values()).sort((a, b) => b.key.localeCompare(a.key)),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredConfrontos, isFaseDeGrupos, mesaMap]);

  const confrontoTitle = (c: Confronto) => {
    if (c.results.length === 2) return `${playerName(c.results[0].player_id)} × ${playerName(c.results[1].player_id)}`;
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

  const isFaseDeGruposEdit = editFase === "Fase de Grupos";
  const rodadaLabel = isFaseDeGruposEdit ? "Rodada" : "Mesa";

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editRodada) { toast.error(`Informe a ${rodadaLabel.toLowerCase()}`); return; }
    if (isFaseDeGruposEdit && !editGrupo.trim()) { toast.error("Informe o grupo"); return; }
    if (editPlayers.some(p => !p.pontos_jogo || !p.pontos_mesa)) {
      toast.error("Preencha pontos de todos os jogadores"); return;
    }
    if (editPlayers.some(p => p.penalidade_tipo === "Outra" && !p.penalidade_outra.trim())) {
      toast.error("Especifique a penalidade 'Outra'"); return;
    }

    setSaving(true);
    const updates = editPlayers.map(p => {
      const penalidades = p.penalidade_tipo === "Outra"
        ? p.penalidade_outra.trim() || "Outra"
        : p.penalidade_tipo;
      return supabase
        .from("match_results")
        .update({
          fase: editFase,
          grupo: isFaseDeGruposEdit ? editGrupo.trim() : editFase,
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
    if (error) { toast.error("Erro ao apagar confronto"); return; }
    toast.success(ids.length > 1 ? "Confronto apagado" : "Registro apagado");
    setDeleting(null);
    load();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registros de confrontos</DialogTitle>
          </DialogHeader>

          {!loading && results.length > 0 && (
            <div className="flex items-end gap-3 flex-wrap">
              {availableFases.length > 1 && (
                <div className="space-y-2">
                  <Label htmlFor="viewer-fase">Fase</Label>
                  <Select value={selectedFase} onValueChange={setSelectedFase}>
                    <SelectTrigger id="viewer-fase" className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableFases.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="viewer-pen">Filtrar por penalidade</Label>
                <Select value={filterPenalidade} onValueChange={setFilterPenalidade}>
                  <SelectTrigger id="viewer-pen" className="w-[220px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as penalidades</SelectItem>
                    {availablePenalidades.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="text-xs text-muted-foreground pb-2">
                {filteredConfrontos.length} {filteredConfrontos.length === 1 ? "confronto" : "confrontos"}
              </div>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto animate-spin opacity-50" />
            </div>
          ) : rodadasGroups.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
                <p>{results.length === 0 ? "Nenhum registro ainda." : "Nenhum registro nesta fase."}</p>
              </CardContent>
            </Card>
          ) : (
            <Accordion type="multiple" className="space-y-2">
              {rodadasGroups.map(group => {
                const total = group.dias.reduce((acc, d) => acc + d.confrontos.length, 0);
                return (
                  <AccordionItem key={`g-${group.rodada}`} value={`g-${group.rodada}`} className="border rounded-md bg-card">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="text-base font-semibold">{groupLabel(group.rodada)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({total} {total === 1 ? "confronto" : "confrontos"})
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4 min-[360px]:px-4">
                      <div className="space-y-6">
                        {group.dias.map(dia => (
                          <section key={dia.key}>
                            <h3 className="text-sm font-semibold mb-2 pb-1 border-b">
                              {formatDayLabel(dia.date)}
                            </h3>
                            <ol className="space-y-3 list-none p-0">
                              {dia.confrontos.map(c => {
                                const hora = formatTime(new Date(c.created_at));
                                return (
                                  <li key={c.key}>
                                    <Card>
                                      <CardContent className="p-3 min-[360px]:p-4 space-y-3">
                                        <div className="flex items-start justify-between gap-2 flex-wrap">
                                          <div className="min-w-0">
                                            <h4 className="text-base font-semibold">{confrontoTitle(c)}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                              {isFaseDeGrupos ? `Grupo ${c.grupo} · Rodada ${c.rodada}` : groupLabel(confrontoGroupKey(c))} · {hora}
                                            </p>
                                          </div>
                                          <div className="flex gap-2 shrink-0">
                                            <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                                              <Pencil className="h-4 w-4 mr-1" /> Editar
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => setDeleting(c)}>
                                              <Trash2 className="h-4 w-4 mr-1" /> Apagar
                                            </Button>
                                          </div>
                                        </div>
                                        <ul className="space-y-2 min-w-0">
                                          {c.results.map(r => {
                                            const maxJogo = Math.max(...c.results.map(p => p.pontos_jogo));
                                            const isWinner = c.results.length > 1 && r.pontos_jogo === maxJogo
                                              && c.results.filter(p => p.pontos_jogo === maxJogo).length === 1;
                                            const penalidade = r.penalidades !== "Sem penalidades";
                                            return (
                                              <li key={r.id} className="rounded-md border bg-muted/30 p-3">
                                                <p className="font-medium">
                                                  {isWinner ? "vitória de " : ""}{playerName(r.player_id)}
                                                </p>
                                                <p className="text-sm mt-1">
                                                  {r.pontos_jogo} ponto{r.pontos_jogo === 1 ? "" : "s"} de vitória, {r.pontos_mesa} ponto{r.pontos_mesa === 1 ? "" : "s"} de mesa.
                                                </p>
                                                {penalidade && (
                                                  <p className="text-sm text-destructive">Penalidades: {r.penalidades}.</p>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                        <p className="text-xs text-muted-foreground">
                                          Registrado por: <span className="font-medium text-foreground">{registeredByName(c.registered_by)}</span>
                                        </p>
                                      </CardContent>
                                    </Card>
                                  </li>
                                );
                              })}
                            </ol>
                          </section>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
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
                  <Label htmlFor="edit-rodada">{rodadaLabel}</Label>
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
                  ? `Esta ação removerá os registros de ${confrontoTitle(deleting)}. Não pode ser desfeita.`
                  : `Esta ação removerá o registro de ${playerName(deleting.results[0].player_id)}. Não pode ser desfeita.`
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
