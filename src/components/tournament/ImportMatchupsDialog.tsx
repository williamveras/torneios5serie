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
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  players: Player[];
  onImported: () => void;
}

export default function ImportMatchupsDialog({ open, onOpenChange, tournamentId, players, onImported }: Props) {
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
    if (!rodada || isNaN(parseInt(rodada, 10))) {
      toast.error("Informe a rodada (número).");
      return;
    }
    if (!text.trim()) {
      toast.error("Cole o texto dos confrontos.");
      return;
    }
    const parsed = parseMatchupsText(text, players);
    if (parsed.length === 0) {
      toast.error("Nenhum confronto detectado no texto.");
      return;
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
    const rd = parseInt(rodada, 10);
    const valid = preview.filter((r) => r.errors.length === 0 && r.player1Id && r.player2Id && r.grupo);
    if (valid.length === 0) {
      toast.error("Nenhuma linha válida para gravar.");
      return;
    }
    setSaving(true);

    const { data: existing } = await supabase
      .from("matchups")
      .select("player1_id, player2_id, rodada")
      .eq("tournament_id", tournamentId)
      .eq("rodada", rd);
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
          fase: "Fase de Grupos",
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

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar confrontos por texto</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-4 items-start">
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
            <div>
              <Label htmlFor="import-text">Texto colado</Label>
              <Textarea
                id="import-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Exemplo:\n\nGrupo 1:\nNando_sousa x Zico10\nTerça 12/05 20:45\n\nGrupo 2:\nfelino x Cowboy\na definir`}
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
                      <TableHead>Grupo</TableHead>
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
                          <TableCell>
                            <Input
                              value={row.grupo}
                              onChange={(e) => updateRow(i, { grupo: e.target.value })}
                              className="h-8 w-16"
                            />
                          </TableCell>
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
