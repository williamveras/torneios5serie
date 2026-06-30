import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { suggestQualificationRules, isPow2 } from "@/lib/qualificationSuggest";

type Tournament = Tables<"tournaments">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  onSaved?: () => void;
}

export default function TournamentSettingsDialog({ open, onOpenChange, tournamentId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [t, setT] = useState<Tournament | null>(null);

  const [nome, setNome] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [numeroRodadas, setNumeroRodadas] = useState<string>("");
  const [directPerGroup, setDirectPerGroup] = useState<string>("");
  const [repescagemEnabled, setRepescagemEnabled] = useState(true);
  const [repescagemTotal, setRepescagemTotal] = useState<string>("");
  const [modalidade, setModalidade] = useState<"individual" | "duplas">("individual");
  const [maxParticipants, setMaxParticipants] = useState<string>("");
  const [lowerScoreWins, setLowerScoreWins] = useState<boolean>(false);
  const [eliminationOnly, setEliminationOnly] = useState<boolean>(false);


  const [totalInscritos, setTotalInscritos] = useState(0);
  const [numGrupos, setNumGrupos] = useState(0);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
      supabase.from("players").select("grupo", { count: "exact" }).eq("tournament_id", tournamentId),
    ]).then(([tr, pr]) => {
      const tour = tr.data as Tournament | null;
      if (tour) {
        setT(tour);
        setNome(tour.nome);
        setDataInicio(tour.data_inicio);
        setNumeroRodadas(tour.numero_rodadas?.toString() ?? "");
        const anyT = tour as any;
        setDirectPerGroup(anyT.direct_per_group?.toString() ?? "");
        setRepescagemEnabled(anyT.repescagem_enabled ?? true);
        setRepescagemTotal(anyT.repescagem_total?.toString() ?? "");
        setModalidade((anyT.modalidade as "individual" | "duplas") ?? "individual");
        setMaxParticipants(anyT.max_participants?.toString() ?? "");
        setLowerScoreWins(anyT.lower_score_wins === true);
        setEliminationOnly(anyT.elimination_only === true);

      }
      const players = (pr.data as { grupo: string | null }[] | null) ?? [];
      setTotalInscritos(players.length);
      const grupos = new Set(players.map(p => p.grupo).filter(g => !!g && g.trim() !== ""));
      setNumGrupos(grupos.size);
      setLoading(false);
    });
  }, [open, tournamentId]);

  // Termos adaptados conforme modalidade (individual vs duplas).
  // Em torneios de duplas, cada "competidor" é uma dupla — uma dupla joga uma partida.
  const isDuplas = modalidade === "duplas";
  const termSing = isDuplas ? "dupla" : "jogador";
  const termPlur = isDuplas ? "duplas" : "jogadores";
  const termPlurCap = isDuplas ? "Duplas" : "Jogadores";

  // Para sugestões: se ainda não há inscritos, usa o limite planejado (max_participants)
  // e deriva o número de grupos a partir das rodadas configuradas
  // (numero_rodadas + 1 = competidores por grupo, num round-robin).
  const effectiveTotal = useMemo(() => {
    if (totalInscritos > 0) return totalInscritos;
    const mx = parseInt(maxParticipants, 10);
    return Number.isFinite(mx) && mx > 0 ? mx : 0;
  }, [totalInscritos, maxParticipants]);
  const effectiveGrupos = useMemo(() => {
    if (numGrupos > 0) return numGrupos;
    const nr = parseInt(numeroRodadas, 10);
    if (!Number.isFinite(nr) || nr < 1 || effectiveTotal < 2) return 0;
    const perGroup = nr + 1;
    return Math.max(1, Math.floor(effectiveTotal / perGroup));
  }, [numGrupos, numeroRodadas, effectiveTotal]);
  const suggestions = useMemo(
    () => suggestQualificationRules(effectiveTotal, effectiveGrupos, { unitSingular: termSing, unitPlural: termPlur }),
    [effectiveTotal, effectiveGrupos, termSing, termPlur],
  );

  const previewTotal = useMemo(() => {
    const k = parseInt(directPerGroup, 10);
    const r = parseInt(repescagemTotal, 10);
    if (!Number.isFinite(k) || !effectiveGrupos) return null;
    const base = k * effectiveGrupos;
    const rep = repescagemEnabled && Number.isFinite(r) ? r : 0;
    return base + rep;
  }, [directPerGroup, repescagemTotal, repescagemEnabled, effectiveGrupos]);

  const applySuggestion = (s: typeof suggestions[number]) => {
    setDirectPerGroup(s.directPerGroup.toString());
    setRepescagemEnabled(s.repescagemEnabled);
    setRepescagemTotal(s.repescagemEnabled ? s.repescagemTotal.toString() : "");
  };

  const handleSave = async () => {
    if (!nome.trim() || !dataInicio) {
      toast.error("Nome e data são obrigatórios");
      return;
    }
    const mxStr = maxParticipants.trim();
    const mx = mxStr ? parseInt(mxStr, 10) : null;
    if (mxStr && (!Number.isFinite(mx) || (mx as number) < 2)) {
      toast.error("Limite de participantes inválido (mínimo 2).");
      return;
    }
    if (mx !== null && totalInscritos > mx) {
      toast.error(`Já há ${totalInscritos} participantes cadastrados. Aumente o limite ou remova inscrições.`);
      return;
    }
    setSaving(true);
    const dpg = directPerGroup.trim() ? parseInt(directPerGroup, 10) : null;
    const rt = repescagemEnabled && repescagemTotal.trim() ? parseInt(repescagemTotal, 10) : null;
    const nr = numeroRodadas.trim() ? parseInt(numeroRodadas, 10) : null;
    const { error } = await (supabase.from("tournaments") as any)
      .update({
        nome: nome.trim(),
        data_inicio: dataInicio,
        numero_rodadas: nr,
        direct_per_group: dpg,
        repescagem_enabled: repescagemEnabled,
        repescagem_total: rt,
        modalidade,
        max_participants: mx,
        lower_score_wins: lowerScoreWins,
        elimination_only: eliminationOnly,

      })
      .eq("id", tournamentId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
      return;
    }
    toast.success("Configurações salvas");
    onSaved?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do torneio</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Nome</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Data de início</Label>
                <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Rodadas da Fase de Grupos</Label>
                <Input
                  type="number"
                  min={1}
                  value={numeroRodadas}
                  onChange={e => setNumeroRodadas(e.target.value)}
                  placeholder="Ex: 7"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Modalidade</Label>
                <Select
                  value={modalidade}
                  onValueChange={(v) => setModalidade(v as "individual" | "duplas")}
                  disabled={totalInscritos > 0}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual">Individual (1 vs 1)</SelectItem>
                    <SelectItem value="duplas">Duplas (2 vs 2)</SelectItem>
                  </SelectContent>
                </Select>
                {totalInscritos > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Não é possível alterar a modalidade com competidores já cadastrados.
                  </p>
                )}
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Limite de {termPlur} participantes (opcional)</Label>
                <Input
                  type="number"
                  min={2}
                  value={maxParticipants}
                  onChange={e => setMaxParticipants(e.target.value)}
                  placeholder={isDuplas ? "Ex: 64" : "Ex: 128"}
                />
                <p className="text-xs text-muted-foreground">
                  {isDuplas
                    ? <>Em torneios de duplas, cada dupla conta como <strong>1 participante</strong> (joga 1 partida por rodada). Se definido, novas inscrições serão bloqueadas ao atingir esse número. Atualmente cadastradas: <strong>{totalInscritos}</strong> {totalInscritos === 1 ? "dupla" : "duplas"}.</>
                    : <>Se definido, novas inscrições serão bloqueadas ao atingir esse número. Atualmente cadastrados: <strong>{totalInscritos}</strong>.</>}
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm">Torneio eliminatório direto (sem Fase de Grupos)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Pula a Fase de Grupos e inicia direto no mata-mata. Ideal para torneios pequenos.
                      O bracket é projetado a partir do total de participantes (ex.: 8 → Quartas → Semi → Final).
                    </p>
                  </div>
                  <Switch checked={eliminationOnly} onCheckedChange={setEliminationOnly} />
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label>Regra de pontuação de mesa</Label>
                <Select
                  value={lowerScoreWins ? "lower" : "higher"}
                  onValueChange={(v) => setLowerScoreWins(v === "lower")}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="higher">Maior pontuação vence (padrão)</SelectItem>
                    <SelectItem value="lower">Menor pontuação vence</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Define como interpretar os pontos de mesa para determinar o vencedor e o desempate. Quando "menor vence", o importador de resultados também passa a marcar como vencedor o de menor pontuação.
                </p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div>
                <h3 className="font-semibold text-sm">Regra de classificação</h3>
                <p className="text-xs text-muted-foreground">
                  Define quais {termPlur} passam da Fase de Grupos para o mata-mata.
                </p>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
                {termPlurCap} inscrit{isDuplas ? "as" : "os"} no momento: <strong>{totalInscritos}</strong> · Grupos:{" "}
                <strong>{numGrupos || "—"}</strong>
                {numGrupos === 0 && effectiveGrupos === 0 && effectiveTotal >= 2 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-300">
                    Preencha <strong>Rodadas da Fase de Grupos</strong> acima para gerar sugestões automáticas
                    (cada grupo terá <em>rodadas + 1</em> {termPlur}).
                  </span>
                )}
                {numGrupos === 0 && effectiveGrupos > 0 && (
                  <span className="block mt-1">
                    Sugestões baseadas no planejamento: <strong>{effectiveTotal}</strong> {termPlur}
                    · <strong>{effectiveGrupos}</strong> grupos estimados ({(parseInt(numeroRodadas, 10) || 0) + 1} {termPlur} por grupo).
                  </span>
                )}
              </div>


              {suggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Sugestões automáticas
                  </div>
                  <div className="grid gap-2">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => applySuggestion(s)}
                        className="text-left rounded-md border px-3 py-2 hover:bg-accent transition-colors text-sm flex items-center justify-between gap-2"
                      >
                        <span>{s.note}</span>
                        {s.fitsBracket && (
                          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{isDuplas ? "Duplas classificadas direto por grupo" : "Classificados direto por grupo"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={directPerGroup}
                    onChange={e => setDirectPerGroup(e.target.value)}
                    placeholder="Padrão: 5"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Repescagem do próximo colocado</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      checked={repescagemEnabled}
                      onCheckedChange={setRepescagemEnabled}
                    />
                    <span className="text-sm text-muted-foreground">
                      {repescagemEnabled ? "Ativada" : "Desativada"}
                    </span>
                  </div>
                </div>
                {repescagemEnabled && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>{isDuplas ? "Quantas melhores duplas entram na repescagem" : "Quantos melhores entram na repescagem"}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={repescagemTotal}
                      onChange={e => setRepescagemTotal(e.target.value)}
                      placeholder="Padrão: 18"
                    />
                  </div>
                )}
              </div>

              {previewTotal !== null && (
                <Alert variant={isPow2(previewTotal) ? "default" : "destructive"}>
                  {isPow2(previewTotal) ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  <AlertDescription>
                    Total de {isDuplas ? "duplas classificadas" : "classificados"}:{" "}
                    <strong>{previewTotal}</strong>{" "}
                    {isPow2(previewTotal)
                      ? "— fecha exatamente num bracket de mata-mata."
                      : "— não é potência de 2 (16, 32, 64, 128…). O mata-mata terá byes ou ajustes."}
                  </AlertDescription>
                </Alert>
              )}

            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
