import { useEffect, useMemo, useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2, FileArchive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  buildTxtZip,
  buildRoundTxt,
  buildGeneralTxt,
  buildPhaseTxt,
  buildWorkbook,
  downloadBlob,
  type BuildCtx,
  type ExpPlayer,
  type ExpTeamMember,
  type ExpMatchup,
  type ExpResult,
} from "@/lib/exportPartner";

interface Props {
  tournamentId: string;
  tournamentName: string;
}

type FileType = "txt" | "xlsx";
type TxtMode = "zip" | "avulso";

export default function ExportTab({ tournamentId, tournamentName }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<BuildCtx | null>(null);

  const [fase, setFase] = useState<string>("");
  const [selectedRounds, setSelectedRounds] = useState<Set<number>>(new Set());
  const [fileType, setFileType] = useState<FileType>("txt");
  const [txtMode, setTxtMode] = useState<TxtMode>("zip");
  const [includeGeneral, setIncludeGeneral] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: players }, { data: members }, { data: matchups }, results] = await Promise.all([
        supabase.from("players").select("id,nome_completo,nick_playroom,is_team").eq("tournament_id", tournamentId),
        supabase
          .from("team_members")
          .select("team_id, member_nome, member_nick, players!inner(tournament_id)")
          .eq("players.tournament_id", tournamentId),
        supabase.from("matchups").select("id,fase,player1_id,player2_id,created_at").eq("tournament_id", tournamentId),
        fetchAllMatchResults(tournamentId),
      ]);
      if (cancelled) return;
      const teamMembers: ExpTeamMember[] = (members || []).map((m: any) => ({
        team_id: m.team_id,
        member_nome: m.member_nome,
        member_nick: m.member_nick,
      }));
      const next: BuildCtx = {
        players: (players as ExpPlayer[]) || [],
        teamMembers,
        matchups: (matchups as ExpMatchup[]) || [],
        results: (results as ExpResult[]) || [],
        tournamentName,
      };
      setCtx(next);
      const fases = [...new Set(next.results.map((r) => r.fase || "Fase de Grupos"))];
      setFase(fases.includes("Fase de Grupos") ? "Fase de Grupos" : fases[0] || "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, tournamentName]);

  const fases = useMemo(() => {
    if (!ctx) return [] as string[];
    const s = new Set<string>();
    for (const r of ctx.results) s.add(r.fase || "Fase de Grupos");
    const arr = [...s];
    arr.sort((a, b) => (a === "Fase de Grupos" ? -1 : b === "Fase de Grupos" ? 1 : a.localeCompare(b)));
    return arr;
  }, [ctx]);

  const isGroupPhase = fase === "Fase de Grupos";

  const rounds = useMemo(() => {
    if (!ctx || !isGroupPhase) return [] as number[];
    const s = new Set<number>();
    for (const r of ctx.results) {
      if ((r.fase || "Fase de Grupos") === "Fase de Grupos" && r.rodada) s.add(r.rodada);
    }
    return [...s].sort((a, b) => a - b);
  }, [ctx, isGroupPhase]);

  useEffect(() => {
    setSelectedRounds(new Set(rounds));
  }, [rounds]);

  const chosen = useMemo(() => [...selectedRounds].sort((a, b) => a - b), [selectedRounds]);
  const multi = chosen.length > 1;

  const toggleRound = (r: number) => {
    const next = new Set(selectedRounds);
    next.has(r) ? next.delete(r) : next.add(r);
    setSelectedRounds(next);
  };

  const dlText = (filename: string, content: string) => {
    if (!content.trim()) {
      toast.error("Sem registros para esta seleção");
      return;
    }
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
  };

  const dlXlsx = (filename: string, buf: ArrayBuffer) => {
    downloadBlob(
      new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      filename,
    );
  };

  const baseName = (tournamentName || "torneio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").toLowerCase();

  const handleDownload = async () => {
    if (!ctx || !fase) return;
    setBusy(true);
    try {
      if (fileType === "xlsx") {
        const buf = buildWorkbook(ctx, fase, chosen, includeGeneral);
        const name = isGroupPhase
          ? multi
            ? `classificacao_${baseName}.xlsx`
            : `Rodada ${chosen[0] ?? 1}.xlsx`
          : `${fase}.xlsx`;
        dlXlsx(name, buf);
      } else if (!isGroupPhase) {
        dlText(`${fase}.txt`, buildPhaseTxt(ctx, fase));
      } else if (!multi) {
        const r = chosen[0];
        dlText(`rodada${r}.txt`, buildRoundTxt(ctx, r));
      } else {
        const blob = await buildTxtZip(ctx, fase, chosen, includeGeneral);
        downloadBlob(blob, `exportacao_${baseName}.zip`);
      }
      toast.success("Exportação concluída");
    } catch (e: any) {
      toast.error("Falha ao exportar", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 mx-auto animate-spin opacity-50" />
        </CardContent>
      </Card>
    );
  }

  if (fases.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum resultado registrado ainda. Registre partidas para habilitar a exportação.
        </CardContent>
      </Card>
    );
  }

  const noRounds = isGroupPhase && chosen.length === 0;
  const showAvulsoLinks = fileType === "txt" && txtMode === "avulso" && isGroupPhase && multi;
  const showTxtModeChoice = fileType === "txt" && isGroupPhase && multi;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="exp-fase">Fase</Label>
              <Select value={fase} onValueChange={setFase}>
                <SelectTrigger id="exp-fase">
                  <SelectValue placeholder="Selecione a fase" />
                </SelectTrigger>
                <SelectContent>
                  {fases.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="exp-tipo">Tipo de arquivo</Label>
              <Select value={fileType} onValueChange={(v) => setFileType(v as FileType)}>
                <SelectTrigger id="exp-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="txt">Texto (.txt)</SelectItem>
                  <SelectItem value="xlsx">Planilha (.xlsx)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isGroupPhase && (
            <div className="space-y-2">
              <Label>Rodadas</Label>
              {rounds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma rodada com resultados nesta fase.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {rounds.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={selectedRounds.has(r)} onCheckedChange={() => toggleRound(r)} />
                      Rodada {r}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {multi && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={includeGeneral} onCheckedChange={(v) => setIncludeGeneral(Boolean(v))} />
              Incluir resultado geral (soma das rodadas selecionadas)
            </label>
          )}

          {showTxtModeChoice && (
            <div className="space-y-2">
              <Label>Como baixar</Label>
              <RadioGroup value={txtMode} onValueChange={(v) => setTxtMode(v as TxtMode)} className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="zip" id="mode-zip" />
                  Pacote .zip
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <RadioGroupItem value="avulso" id="mode-avulso" />
                  Arquivos avulsos
                </label>
              </RadioGroup>
            </div>
          )}

          {!showAvulsoLinks && (
            <div className="pt-1">
              <Button onClick={handleDownload} disabled={busy || noRounds}>
                {busy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : fileType === "xlsx" ? (
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                ) : multi ? (
                  <FileArchive className="h-4 w-4 mr-2" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {fileType === "xlsx" ? "Baixar planilha" : multi ? "Baixar pacote (.zip)" : "Baixar arquivo (.txt)"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {showAvulsoLinks && ctx && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Label className="text-sm font-medium">Arquivos avulsos</Label>
            <Separator />
            <div className="grid gap-2">
              {chosen.map((r) => (
                <div key={r} className="flex items-center gap-3">
                  <span className="text-sm w-24">Rodada {r}</span>
                  <Button size="sm" variant="outline" onClick={() => dlText(`rodada${r}.txt`, buildRoundTxt(ctx, r))}>
                    <FileText className="h-3 w-3 mr-1" /> Baixar rodada{r}.txt
                  </Button>
                </div>
              ))}
              {includeGeneral && (
                <div className="flex items-center gap-3">
                  <span className="text-sm w-24">Geral</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => dlText("resultados gerais.txt", buildGeneralTxt(ctx, chosen))}
                  >
                    <FileText className="h-3 w-3 mr-1" /> Baixar resultados gerais.txt
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
