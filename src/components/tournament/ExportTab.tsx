import { useEffect, useMemo, useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  buildZip,
  buildRoundTxt,
  buildGeneralTxt,
  buildPhaseTxt,
  buildXlsx,
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

export default function ExportTab({ tournamentId, tournamentName }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [ctx, setCtx] = useState<BuildCtx | null>(null);

  const [selectedRounds, setSelectedRounds] = useState<Set<number>>(new Set());
  const [includeGeneral, setIncludeGeneral] = useState(true);
  const [selectedPhases, setSelectedPhases] = useState<Set<string>>(new Set());

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
      const ctx: BuildCtx = {
        players: (players as ExpPlayer[]) || [],
        teamMembers,
        matchups: (matchups as ExpMatchup[]) || [],
        results: (results as ExpResult[]) || [],
        tournamentName,
      };
      setCtx(ctx);

      const gpRounds = new Set<number>();
      for (const r of ctx.results) {
        if ((r.fase || "Fase de Grupos") === "Fase de Grupos" && r.rodada) gpRounds.add(r.rodada);
      }
      setSelectedRounds(new Set(gpRounds));

      const elimPhases = new Set<string>();
      for (const r of ctx.results) {
        const f = r.fase || "Fase de Grupos";
        if (f !== "Fase de Grupos") elimPhases.add(f);
      }
      setSelectedPhases(new Set(elimPhases));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, tournamentName]);

  const groupRounds = useMemo(() => {
    if (!ctx) return [] as number[];
    const s = new Set<number>();
    for (const r of ctx.results) {
      if ((r.fase || "Fase de Grupos") === "Fase de Grupos" && r.rodada) s.add(r.rodada);
    }
    return [...s].sort((a, b) => a - b);
  }, [ctx]);

  const elimPhases = useMemo(() => {
    if (!ctx) return [] as string[];
    const s = new Set<string>();
    for (const r of ctx.results) {
      const f = r.fase || "Fase de Grupos";
      if (f !== "Fase de Grupos") s.add(f);
    }
    return [...s];
  }, [ctx]);

  const toggleRound = (r: number) => {
    const next = new Set(selectedRounds);
    next.has(r) ? next.delete(r) : next.add(r);
    setSelectedRounds(next);
  };
  const togglePhase = (f: string) => {
    const next = new Set(selectedPhases);
    next.has(f) ? next.delete(f) : next.add(f);
    setSelectedPhases(next);
  };

  const zipName = (tournamentName || "torneio").replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, "_").toLowerCase();

  const handleZip = async () => {
    if (!ctx) return;
    setBusy(true);
    try {
      const blob = await buildZip({
        ctx,
        groupsRounds: [...selectedRounds].sort((a, b) => a - b),
        elimPhases: [...selectedPhases],
        includeGroupsGeneral: includeGeneral,
      });
      downloadBlob(blob, `exportacao_${zipName}.zip`);
      toast.success("Pacote exportado");
    } catch (e: any) {
      toast.error("Falha ao gerar pacote", { description: e?.message });
    } finally {
      setBusy(false);
    }
  };

  const dlText = (filename: string, content: string) => {
    if (!content.trim()) {
      toast.error("Sem registros para esta seleção");
      return;
    }
    downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), filename);
  };

  const dlXlsx = (filename: string, buf: ArrayBuffer) => {
    downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
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

  const hasAny = groupRounds.length > 0 || elimPhases.length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Gera um pacote <b>.zip</b> com arquivos <b>.txt</b> (por rodada e geral) e planilhas <b>.xlsx</b>{" "}
            estilizadas.
          </p>

          {!hasAny && (
            <p className="text-sm text-muted-foreground">
              Nenhum resultado registrado ainda. Registre partidas para habilitar a exportação.
            </p>
          )}

          {groupRounds.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fase de Grupos — rodadas</Label>
              <div className="flex flex-wrap gap-3">
                {groupRounds.map((r) => (
                  <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      id={`round-${r}`}
                      checked={selectedRounds.has(r)}
                      onCheckedChange={() => toggleRound(r)}
                    />
                    Rodada {r}
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
                <Checkbox
                  id="include-general"
                  checked={includeGeneral}
                  onCheckedChange={(v) => setIncludeGeneral(Boolean(v))}
                />
                Incluir <code className="text-xs">resultados gerais.txt</code>
              </label>
            </div>
          )}

          {elimPhases.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fases eliminatórias</Label>
              <div className="flex flex-wrap gap-3">
                {elimPhases.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      id={`phase-${f}`}
                      checked={selectedPhases.has(f)}
                      onCheckedChange={() => togglePhase(f)}
                    />
                    {f}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={handleZip} disabled={busy || !hasAny}>
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Baixar pacote (.zip)
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasAny && ctx && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Downloads avulsos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupRounds.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Fase de Grupos</Label>
                <div className="grid gap-2">
                  {groupRounds.map((r) => (
                    <div key={r} className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm w-24">Rodada {r}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => dlText(`rodada${r}.txt`, buildRoundTxt(ctx, r))}
                      >
                        <FileText className="h-3 w-3 mr-1" /> TXT
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          dlXlsx(`Rodada ${r}.xlsx`, buildXlsx(ctx, "Fase de Grupos", r, `Classificação - Rodada ${r}`))
                        }
                      >
                        <FileSpreadsheet className="h-3 w-3 mr-1" /> XLSX
                      </Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm w-24">Geral</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dlText("resultados gerais.txt", buildGeneralTxt(ctx))}
                    >
                      <FileText className="h-3 w-3 mr-1" /> TXT
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {elimPhases.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Eliminatórias</Label>
                  <div className="grid gap-2">
                    {elimPhases.map((f) => (
                      <div key={f} className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm w-40 truncate">{f}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => dlText(`${f}.txt`, buildPhaseTxt(ctx, f))}
                        >
                          <FileText className="h-3 w-3 mr-1" /> TXT
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            dlXlsx(`${f}.xlsx`, buildXlsx(ctx, f, null, `Classificação - ${f}`))
                          }
                        >
                          <FileSpreadsheet className="h-3 w-3 mr-1" /> XLSX
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
