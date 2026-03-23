import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";
import { FASES } from "@/lib/constants";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type Player = Tables<"players">;
type Profile = Tables<"profiles">;

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedFase, setSelectedFase] = useState<string>("Fase de Grupos");
  const [selectedGroup, setSelectedGroup] = useState<string>("__all__");

  const isFaseDeGrupos = selectedFase === "Fase de Grupos";

  useEffect(() => {
    Promise.all([
      supabase.from("match_results").select("*").eq("tournament_id", tournamentId),
      supabase.from("players").select("*").eq("tournament_id", tournamentId),
      supabase.from("profiles").select("*"),
    ]).then(([r, p, pr]) => {
      if (r.data) setResults(r.data);
      if (p.data) setPlayers(p.data);
      if (pr.data) setProfiles(pr.data);
    });
  }, [tournamentId]);

  const getPlayerNick = (id: string) => players.find(p => p.id === id)?.nick_playroom || "";
  const getPlayerName = (id: string) => players.find(p => p.id === id)?.nome_completo || "Desconhecido";
  const getRegistrantName = (userId: string | null) => {
    if (!userId) return "—";
    return profiles.find(p => p.user_id === userId)?.nome || "—";
  };

  // Available fases that actually have data
  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => (r as any).fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const filteredByFase = useMemo(() => {
    return results.filter(r => ((r as any).fase || "Fase de Grupos") === selectedFase);
  }, [results, selectedFase]);

  const groups = useMemo(() => [...new Set(filteredByFase.map(r => r.grupo))].sort(), [filteredByFase]);

  const filteredResults = useMemo(() => {
    if (!isFaseDeGrupos || selectedGroup === "__all__") return filteredByFase;
    return filteredByFase.filter(r => r.grupo === selectedGroup);
  }, [filteredByFase, selectedGroup, isFaseDeGrupos]);

  const rounds = useMemo(() => [...new Set(filteredResults.map(r => r.rodada))].sort((a, b) => a - b), [filteredResults]);

  const standings = useMemo(() => {
    const agg = new Map<string, { pontosJogo: number; pontosMesa: number; penalties: string[] }>();
    for (const r of filteredResults) {
      const prev = agg.get(r.player_id) || { pontosJogo: 0, pontosMesa: 0, penalties: [] };
      prev.pontosJogo += r.pontos_jogo;
      prev.pontosMesa += r.pontos_mesa;
      if (r.penalidades !== "Sem penalidades") prev.penalties.push(r.penalidades);
      agg.set(r.player_id, prev);
    }

    const rows: StandingRow[] = [];
    for (const [playerId, data] of agg) {
      rows.push({
        position: 0,
        playerName: getPlayerName(playerId),
        nick: getPlayerNick(playerId),
        pontosJogo: data.pontosJogo,
        pontosMesa: data.pontosMesa,
        penalidades: data.penalties.length > 0 ? data.penalties.join("; ") : "Sem penalidades",
        hasPenalty: data.penalties.length > 0,
      });
    }

    rows.sort((a, b) => {
      if (a.hasPenalty !== b.hasPenalty) return a.hasPenalty ? 1 : -1;
      if (a.pontosJogo !== b.pontosJogo) return b.pontosJogo - a.pontosJogo;
      return b.pontosMesa - a.pontosMesa;
    });
    rows.forEach((r, i) => { r.position = i + 1; });
    return rows;
  }, [filteredResults, players]);

  const exportToXlsx = () => {
    const data = standings.map(s => ({
      "Posição": s.position,
      "Nick": s.nick || s.playerName,
      "Pts Jogo": s.pontosJogo,
      "Pts Mesa": s.pontosMesa,
      "Penalidades": s.penalidades,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Classificação");
    const groupLabel = isFaseDeGrupos && selectedGroup !== "__all__" ? `_grupo_${selectedGroup}` : "";
    XLSX.writeFile(wb, `classificacao_${selectedFase.replace(/ /g, "_")}${groupLabel}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="space-y-2">
          <Label>Fase</Label>
          <Select value={selectedFase} onValueChange={v => { setSelectedFase(v); setSelectedGroup("__all__"); }}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(availableFases.length > 0 ? availableFases : FASES).map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isFaseDeGrupos && (
          <div className="space-y-2">
            <Label>Grupo</Label>
            <Select value={selectedGroup} onValueChange={setSelectedGroup}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os grupos</SelectItem>
                {groups.map(g => <SelectItem key={g} value={g}>Grupo {g}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
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
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="standings">
          <TabsList>
            <TabsTrigger value="standings">Classificação Geral</TabsTrigger>
            <TabsTrigger value="rounds">Resultados por Rodada</TabsTrigger>
          </TabsList>

          <TabsContent value="standings">
            <div className="rounded-lg border bg-background">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">#</TableHead>
                    <TableHead>Nick</TableHead>
                    <TableHead className="text-right">Pts Jogo</TableHead>
                    <TableHead className="text-right">Pts Mesa</TableHead>
                    <TableHead>Penalidades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map(s => (
                    <TableRow key={s.nick + s.position} className={s.hasPenalty ? "bg-destructive/5" : ""}>
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
          </TabsContent>

          <TabsContent value="rounds" className="space-y-4">
            {rounds.map(round => {
              const roundResults = filteredResults.filter(r => r.rodada === round);
              return (
                <Card key={round}>
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-3">Rodada {round}</h3>
                    <div className="rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nick</TableHead>
                            {isFaseDeGrupos && <TableHead>Grupo</TableHead>}
                            <TableHead className="text-right">Pts Jogo</TableHead>
                            <TableHead className="text-right">Pts Mesa</TableHead>
                            <TableHead>Penalidades</TableHead>
                            <TableHead>Registrado por</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {roundResults.map(r => (
                            <TableRow key={r.id}>
                              <TableCell className="font-medium">{getPlayerNick(r.player_id) || getPlayerName(r.player_id)}</TableCell>
                              {isFaseDeGrupos && <TableCell>{r.grupo}</TableCell>}
                              <TableCell className="text-right tabular-nums">{r.pontos_jogo}</TableCell>
                              <TableCell className="text-right tabular-nums">{r.pontos_mesa}</TableCell>
                              <TableCell className={r.penalidades !== "Sem penalidades" ? "text-destructive" : "text-muted-foreground"}>
                                {r.penalidades}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">{getRegistrantName(r.registered_by)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
