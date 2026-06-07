import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { parseMatchupsText, type ParsedMatchup } from "@/lib/matchupParser";
import { isGroupPhase } from "@/lib/phase";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  players: Player[];
  activePhase?: string;
  onImported: () => void;
}

export default function ImportMatchupsDialog({ open, onOpenChange, tournamentId, players, activePhase, onImported }: Props) {
  const fase = activePhase || "Fase de Grupos";
  const groupPhase = isGroupPhase(fase);

  const [rodada, setRodada] = useState<string>("");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedMatchup[] | null>(null);
  const [saving, setSaving] = useState(false);

  function reset() {
    setRodada("");
    setText("");
    setPreview(null);
  }

  function handlePreview() {
    if (groupPhase && (!rodada || isNaN(parseInt(rodada, 10)))) {
      toast.error("Informe a rodada (número).");
      return;
    }
    if (!text.trim()) {
      toast.error("Cole o texto dos confrontos.");
      return;
    }
    const parsed = parseMatchupsText(text, players, { ignoreGroups: !groupPhase });
    if (parsed.length === 0) {
      toast.error("Nenhum confronto detectado no texto.");
      return;
    }
    if (!groupPhase) {
      // Mata-mata: força grupo = fase (sem cabeçalho de grupo no texto)
      parsed.forEach((r) => { r.grupo = fase; });
    }
    setPreview(parsed);
  }

  function updateRow(index: number, patch: Partial<ParsedMatchup>) {
    setPreview((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  }

  async function handleConfirm() {
    if (!preview) return;
    const rd = groupPhase ? parseInt(rodada, 10) : null;
    const valid = preview.filter((r) => r.errors.length === 0 && r.player1Id && r.player2Id && r.grupo);
    if (valid.length === 0) {
      toast.error("Nenhuma linha válida para gravar.");
      return;
    }
    setSaving(true);

    let existingQuery = supabase
      .from("matchups")
      .select("player1_id, player2_id, rodada, fase")
      .eq("tournament_id", tournamentId)
      .eq("fase", fase);
    if (groupPhase && rd != null) existingQuery = existingQuery.eq("rodada", rd);
    const { data: existing } = await existingQuery;
    const existingPairs = new Set(
      (existing || []).map((m: any) => [m.player1_id, m.player2_id].sort().join("|"))
    );

    let inserted = 0;
    let scheduled = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of valid) {
      const key = [row.player1Id!, row.player2Id!].sort().join("|");
      if (existingPairs.has(key)) {
        skipped++;
      } else {
        const { error } = await supabase.from("matchups").insert({
          tournament_id: tournamentId,
          rodada: rd,
          grupo: row.grupo,
          fase,
          player1_id: row.player1Id!,
          player2_id: row.player2Id!,
        });
        if (error) {
          failed++;
          continue;
        }
        inserted++;
        existingPairs.add(key);
      }

      if (row.data && row.horario) {
        const { error: schedErr } = await supabase.from("match_schedule").insert({
          tournament_id: tournamentId,
          grupo: row.grupo,
          player1_id: row.player1Id!,
          player2_id: row.player2Id!,
          data_partida: row.data,
          horario: row.horario,
          observacao: row.observacao || null,
          rodada: rd,
        } as any);
        if (!schedErr) scheduled++;
      } else if (row.observacao) {
        const { error: schedErr } = await supabase.from("match_schedule").insert({
          tournament_id: tournamentId,
          grupo: row.grupo,
          player1_id: row.player1Id!,
          player2_id: row.player2Id!,
          data_partida: null,
          horario: null,
          observacao: row.observacao,
          rodada: rd,
        } as any);
        if (!schedErr) scheduled++;
      }
    }

    setSaving(false);
    toast.success(
      `Importação concluída: ${inserted} confronto(s), ${scheduled} agendamento(s), ${skipped} já existente(s)${failed ? `, ${failed} com erro` : ""}.`
    );
    onImported();
    reset();
    onOpenChange(false);
  }

  const placeholderText = groupPhase
    ? `Exemplo:\n\nGrupo 1:\nNando_sousa x Zico10\nTerça 12/05 20:45\n\nGrupo 2:\nfelino x Cowboy\na definir`
    : `Exemplo:\n\nNando_sousa x Zico10\nTerça 12/05 20:45\n\nfelino x Cowboy\na definir`;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar confrontos por texto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Importando para a <strong>{fase}</strong>.
            {!groupPhase && " Não é necessário informar grupo nem rodada — as mesas serão numeradas pela ordem de cadastro."}
          </p>

          <div className={`grid grid-cols-1 gap-4 items-start ${groupPhase ? "sm:grid-cols-[120px_1fr]" : ""}`}>
            {groupPhase && (
              <div>
                <Label htmlFor="import-rodada">Rodada</Label>
                <Input
                  id="import-rodada"
                  type="number"
                  min={1}
                  value={rodada}
                  onChange={(e) => setRodada(e.target.value)}
                  placeholder="Ex: 4"
                />
              </div>
            )}
            <div>
              <Label htmlFor="import-text">Texto colado</Label>
              <Textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={placeholderText}
                rows={10}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {!preview ? (
            <div className="flex justify-end">
              <Button onClick={handlePreview}>Pré-visualizar</Button>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {groupPhase && <TableHead>Grupo</TableHead>}
                      <TableHead>Jogador 1</TableHead>
                      <TableHead>Jogador 2</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Horário</TableHead>
                      <TableHead>Observação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, i) => {
                      const hasError = row.errors.length > 0;
                      return (
                        <TableRow key={i} className={hasError ? "bg-destructive/10" : ""}>
                          {groupPhase && (
                            <TableCell>
                              <Input
                                value={row.grupo}
                                onChange={(e) => updateRow(i, { grupo: e.target.value })}
                                className="h-8 w-16"
                              />
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="text-sm">{row.player1Name}</div>
                            {!row.player1Id && <div className="text-xs text-destructive">não encontrado</div>}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{row.player2Name}</div>
                            {!row.player2Id && <div className="text-xs text-destructive">não encontrado</div>}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="date"
                              value={row.data || ""}
                              onChange={(e) => updateRow(i, { data: e.target.value || undefined })}
                              className="h-8 w-36"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="time"
                              value={row.horario || ""}
                              onChange={(e) => updateRow(i, { horario: e.target.value || undefined })}
                              className="h-8 w-24"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={row.observacao || ""}
                              onChange={(e) => updateRow(i, { observacao: e.target.value || undefined })}
                              className="h-8"
                              placeholder="—"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Linhas em vermelho têm erros e serão ignoradas. Confrontos com observação (W.O / a definir) são gravados sem horário na agenda.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          {preview && (
            <>
              <Button variant="outline" onClick={() => setPreview(null)}>Voltar</Button>
              <Button onClick={handleConfirm} disabled={saving}>
                {saving ? "Gravando..." : "Confirmar e gravar"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
