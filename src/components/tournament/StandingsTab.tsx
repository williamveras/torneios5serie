import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Download, BarChart3, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FASES } from "@/lib/constants";
import { computeStandings } from "@/lib/standings";
import { computeQualifiers, nextPhaseName } from "@/lib/qualifiers";
import QualifiersView from "@/components/QualifiersView";
import { computeCurrentRound } from "@/lib/rounds";
import type { Tables } from "@/integrations/supabase/types";


type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;

interface Props { tournamentId: string; }

const naturalGroupSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
};

const hasGroup = (g: string | null | undefined) => !!g && g.trim() !== "";

export default function StandingsTab({ tournamentId }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [phaseStatuses, setPhaseStatuses] = useState<Tables<"phase_status">[]>([]);
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");
  const [matchups, setMatchups] = useState<Tables<"matchups">[]>([]);
  const [numeroRodadas, setNumeroRodadas] = useState<number | null>(null);

  const loadPhaseStatuses = () => {
    supabase.from("phase_status").select("*").eq("tournament_id", tournamentId).then(({ data }) => {
      if (data) setPhaseStatuses(data);
    });
  };

  useEffect(() => {
    Promise.all([
      fetchAllMatchResults(tournamentId).then(data => ({ data })),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("matchups").select("*").eq("tournament_id", tournamentId),
      supabase.from("tournaments").select("numero_rodadas").eq("id", tournamentId).maybeSingle(),
    ]).then(([r, p, m, t]) => {
      if (r.data) setResults(r.data);
      if (p.data) setPlayers(p.data);
      if (m.data) setMatchups(m.data);
      if (t.data) setNumeroRodadas((t.data as any).numero_rodadas ?? null);
    });
    loadPhaseStatuses();
  }, [tournamentId]);

  const grupoStatus = phaseStatuses.find(p => p.fase === "Fase de Grupos")?.status || "em_andamento";
  const grupoConcluded = grupoStatus === "concluida";

  // Auto-close Fase de Grupos when all rounds are complete
  useEffect(() => {
    if (grupoConcluded) return;
    if (!numeroRodadas) return;
    if (matchups.length === 0 || results.length === 0) return;
    const { phaseComplete } = computeCurrentRound(matchups as any, results as any, numeroRodadas);
    if (!phaseComplete) return;

    const existing = phaseStatuses.find(p => p.fase === "Fase de Grupos");
    const op = existing
      ? supabase.from("phase_status").update({ status: "concluida" }).eq("id", existing.id)
      : supabase.from("phase_status").insert({
          tournament_id: tournamentId, fase: "Fase de Grupos", status: "concluida",
        });
    op.then(({ error }) => {
      if (error) return;
      toast.success("Fase de Grupos encerrada automaticamente — todas as rodadas concluídas.");
      loadPhaseStatuses();
    });
  }, [matchups, results, numeroRodadas, phaseStatuses, grupoConcluded, tournamentId]);

  const currentPhaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isConcluded = currentPhaseStatus === "concluida";

  const togglePhaseStatus = async () => {
    const newStatus = isConcluded ? "em_andamento" : "concluida";
    const existing = phaseStatuses.find(p => p.fase === selectedFase);
    if (existing) {
      const { error } = await supabase.from("phase_status").update({ status: newStatus }).eq("id", existing.id);
      if (error) { toast.error("Erro ao atualizar fase"); return; }
    } else {
      const { error } = await supabase.from("phase_status").insert({
        tournament_id: tournamentId, fase: selectedFase, status: newStatus,
      });
      if (error) { toast.error("Erro ao atualizar fase"); return; }
    }
    toast.success(newStatus === "concluida" ? "Fase marcada como concluída" : "Fase reaberta");
    loadPhaseStatuses();
  };

  const getPlayerNick = (id: string) => players.find(p => p.id === id)?.nick_playroom || "";
  const getPlayerName = (id: string) => players.find(p => p.id === id)?.nome_completo || "Desconhecido";

  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => r.fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const filteredByFase = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === selectedFase),
    [results, selectedFase],
  );

  const hasAnyGroup = useMemo(() => filteredByFase.some(r => hasGroup(r.grupo)), [filteredByFase]);

  // Groups present in this phase (only non-empty)
  const groups = useMemo(
    () => [...new Set(filteredByFase.filter(r => hasGroup(r.grupo)).map(r => r.grupo))].sort(naturalGroupSort),
    [filteredByFase],
  );

  // Standings grouped by group (or single bucket "" when no groups)
  const sections = useMemo(() => {
    if (!hasAnyGroup) {
      return [{
        grupo: "",
        rows: computeStandings(filteredByFase, getPlayerName, getPlayerNick),
      }];
    }
    return groups.map(g => ({
      grupo: g,
      rows: computeStandings(
        filteredByFase.filter(r => r.grupo === g),
        getPlayerName,
        getPlayerNick,
      ),
    }));
  }, [filteredByFase, groups, hasAnyGroup, players]);

  const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);

  const exportToXlsx = () => {
    const wb = XLSX.utils.book_new();

    if (!hasAnyGroup) {
      const data = sections[0].rows.map(s => ({
        "Posição": s.position,
        "Nick": s.nick || s.playerName,
        "Pts Vitória": s.pontosJogo,
        "Pts Mesa": s.pontosMesa,
        "Penalidades": s.penalidades,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Classificação");
    } else {
      // Geral sheet (everyone, with Group column)
      const geral = sections.flatMap(sec =>
        sec.rows.map(s => ({
          "Grupo": sec.grupo,
          "Posição no Grupo": s.position,
          "Nick": s.nick || s.playerName,
          "Pts Vitória": s.pontosJogo,
          "Pts Mesa": s.pontosMesa,
          "Penalidades": s.penalidades,
        })),
      );
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(geral), "Geral");

      // One sheet per group
      sections.forEach(sec => {
        const data = sec.rows.map(s => ({
          "Posição": s.position,
          "Nick": s.nick || s.playerName,
          "Pts Vitória": s.pontosJogo,
          "Pts Mesa": s.pontosMesa,
          "Penalidades": s.penalidades,
        }));
        const sheetName = `Grupo ${sec.grupo}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), sheetName);
      });
    }

    XLSX.writeFile(wb, `classificacao_${selectedFase.replace(/ /g, "_")}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label htmlFor="standings-fase">Fase</Label>
          <Select value={selectedFase} onValueChange={setSelectedFase}>
            <SelectTrigger id="standings-fase" aria-label="Fase" className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(availableFases.length > 0 ? availableFases : FASES).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={isConcluded ? "outline" : "default"}
          onClick={togglePhaseStatus}
          size="sm"
        >
          {isConcluded ? <><Unlock className="h-4 w-4 mr-1" /> Reabrir fase</> : <><Lock className="h-4 w-4 mr-1" /> Marcar fase como concluída</>}
        </Button>
        {totalRows > 0 && (
          <Button variant="outline" onClick={exportToXlsx}>
            <Download className="h-4 w-4 mr-1" /> Exportar Planilha
          </Button>
        )}
      </div>



      {totalRows === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sections.map(sec => (
            <section key={sec.grupo || "__no_group__"}>
              {hasAnyGroup && (
                <h3 className="font-semibold text-lg mb-2">
                  Grupo {sec.grupo}
                </h3>
              )}
              <div className="rounded-lg border bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Nick</TableHead>
                      <TableHead className="text-right">Pts Vitória</TableHead>
                      <TableHead className="text-right">Pts Mesa</TableHead>
                      <TableHead>Penalidades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sec.rows.map(s => (
                      <TableRow key={s.playerId} className={s.hasPenalty ? "bg-destructive/5" : ""}>
                        <TableCell className="font-bold tabular-nums">{s.position}º</TableCell>
                        <TableCell className="font-medium">{s.nick || s.playerName}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.pontosJogo}</TableCell>
                        <TableCell className="text-right tabular-nums">{s.pontosMesa}</TableCell>
                        <TableCell className={s.hasPenalty ? "text-destructive" : "text-muted-foreground"}>{s.penalidades}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
