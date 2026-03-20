import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Download, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;

interface Props { tournamentId: string; }

interface StandingRow {
  position: number;
  playerName: string;
  nick: string;
  pontosJogo: number;
  pontosMesa: number;
  penalidades: string;
  hasPenalty: boolean;
}

export default function StandingsTab({ tournamentId }: Props) {
  const [results, setResults] = useState<MatchResult[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");

  useEffect(() => {
    Promise.all([
      supabase.from("match_results").select("*").eq("tournament_id", tournamentId),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
    ]).then(([r, p]) => {
      if (r.data) setResults(r.data);
      if (p.data) setPlayers(p.data);
    });
  }, [tournamentId]);

  const groups = useMemo(() => [...new Set(results.map(r => r.grupo))].sort(), [results]);

  const standings = useMemo(() => {
    const filtered = selectedGroup === "__all__" ? results : results.filter(r => r.grupo === selectedGroup);

    // Aggregate per player
    const agg = new Map<string, { pontosJogo: number; pontosMesa: number; penalties: string[] }>();
    for (const r of filtered) {
      const prev = agg.get(r.player_id) || { pontosJogo: 0, pontosMesa: 0, penalties: [] };
      prev.pontosJogo += r.pontos_jogo;
      prev.pontosMesa += r.pontos_mesa;
      if (r.penalidades !== "Sem penalidades") prev.penalties.push(r.penalidades);
      agg.set(r.player_id, prev);
    }

    const rows: StandingRow[] = [];
    for (const [playerId, data] of agg) {
      const player = players.find(p => p.id === playerId);
      rows.push({
        position: 0,
        playerName: player?.nome_completo || "Desconhecido",
        nick: player?.nick_playroom || "",
        pontosJogo: data.pontosJogo,
        pontosMesa: data.pontosMesa,
        penalidades: data.penalties.length > 0 ? data.penalties.join("; ") : "Sem penalidades",
        hasPenalty: data.penalties.length > 0,
      });
    }

    // Sort: penalty players last, then by pontos_jogo desc, then pontos_mesa desc
    rows.sort((a, b) => {
      if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
      if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
      return b.pontosMesa - a.pontosMesa;
    });

    rows.forEach((r, i) => { r.position = i + 1; });
    return rows;
  }, [results, players, selectedGroup]);

  const exportToXlsx = () => {
    const data = standings.map(s => ({
      "Posição": s.position,
      "Jogador": s.playerName,
      "Nick": s.nick,
      "Pontos de Jogo": s.pontosJogo,
      "Pontos de Mesa": s.pontosMesa,
      "Penalidades": s.penalidades,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Classificação");
    XLSX.writeFile(wb, `classificacao_${selectedGroup === "__all__" ? "geral" : `grupo_${selectedGroup}`}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Filtrar por grupo</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os grupos</SelectItem>
              {groups.map(g => <SelectItem key={g} value={g}>Grupo {g}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {standings.length > 0 && (
          <Button variant="outline" onClick={exportToXlsx}>
            <Download className="h-4 w-4 mr-1" /> Exportar Planilha
          </Button>
        )}
      </div>

      {standings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum resultado registrado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Jogador</TableHead>
                <TableHead>Nick</TableHead>
                <TableHead className="text-right">Pts Jogo</TableHead>
                <TableHead className="text-right">Pts Mesa</TableHead>
                <TableHead>Penalidades</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.map(s => (
                <TableRow key={s.playerName + s.position} className={s.hasPenalty ? "bg-destructive/5" : ""}>
                  <TableCell className="font-bold tabular-nums">{s.position}º</TableCell>
                  <TableCell className="font-medium">{s.playerName}</TableCell>
                  <TableCell>{s.nick || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.pontosJogo}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.pontosMesa}</TableCell>
                  <TableCell className={s.hasPenalty ? "text-destructive" : "text-muted-foreground"}>{s.penalidades}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
