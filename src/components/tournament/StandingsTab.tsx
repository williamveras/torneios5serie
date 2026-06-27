import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllMatchResults } from "@/lib/fetchAll";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Download, BarChart3, Lock, Unlock, Info } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { FASES, isSideFase } from "@/lib/constants";
import { computeStandings } from "@/lib/standings";
import { computeQualifiers, nextPhaseName } from "@/lib/qualifiers";
import QualifiersView from "@/components/QualifiersView";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { computeCurrentRound } from "@/lib/rounds";
import { projectPhases, findPhaseInProjection } from "@/lib/phaseProjection";
import PhaseRoadmap from "@/components/PhaseRoadmap";
import BracketView from "@/components/BracketView";
import { pairKey } from "@/lib/phase";
import { getPlayerDisplayName, getPlayerNickForStandings } from "@/lib/playerDisplay";
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
  const [campeaoId, setCampeaoId] = useState<string | null>(null);
  const [qualifierOpts, setQualifierOpts] = useState<{ directPerGroup?: number; repescagemTotal?: number }>({});
  const [lowerWins, setLowerWins] = useState<boolean>(false);

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
      supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle(),
    ]).then(([r, p, m, t]) => {
      if (r.data) setResults(r.data);
      if (p.data) setPlayers(p.data);
      if (m.data) setMatchups(m.data);
      if (t.data) {
        const td = t.data as any;
        setNumeroRodadas(td.numero_rodadas ?? null);
        setCampeaoId(td.campeao_id ?? null);
        setLowerWins(td.lower_score_wins === true);
        const opts: { directPerGroup?: number; repescagemTotal?: number } = {};
        if (td.direct_per_group != null) opts.directPerGroup = td.direct_per_group;
        if (td.repescagem_enabled === false) opts.repescagemTotal = 0;
        else if (td.repescagem_total != null) opts.repescagemTotal = td.repescagem_total;
        setQualifierOpts(opts);
      }
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

  // Auto-close fases ELIMINATÓRIAS (mata-mata) quando todos os confrontos
  // da fase têm resultado registrado para ambos os jogadores.
  useEffect(() => {
    if (matchups.length === 0) return;
    const elimFases = FASES.filter(f => f !== "Fase de Grupos");
    for (const fase of elimFases) {
      const status = phaseStatuses.find(p => p.fase === fase)?.status;
      if (status === "concluida") continue;
      const faseMatchups = matchups.filter(m => (m.fase || "Fase de Grupos") === fase);
      if (faseMatchups.length === 0) continue;
      // Conjunto de pares jogador/fase com resultado registrado
      const playersWithResult = new Set(
        results
          .filter(r => (r.fase || "Fase de Grupos") === fase)
          .map(r => r.player_id),
      );
      const allDone = faseMatchups.every(
        m => playersWithResult.has(m.player1_id) && playersWithResult.has(m.player2_id),
      );
      if (!allDone) continue;
      const existing = phaseStatuses.find(p => p.fase === fase);
      const op = existing
        ? supabase.from("phase_status").update({ status: "concluida" }).eq("id", existing.id)
        : supabase.from("phase_status").insert({
            tournament_id: tournamentId, fase, status: "concluida",
          });
      op.then(({ error }) => {
        if (error) return;
        toast.success(`${fase} encerrada automaticamente — todos os confrontos concluídos.`);
        loadPhaseStatuses();
      });
      // Trata uma fase por ciclo para evitar updates concorrentes
      break;
    }
  }, [matchups, results, phaseStatuses, tournamentId]);

  // Auto-elimina o perdedor de cada confronto eliminatório completo (mata-mata).
  // Critério: maior pontos_jogo vence; empate → maior pontos_mesa; empate total → não decide.
  useEffect(() => {
    if (matchups.length === 0 || results.length === 0 || players.length === 0) return;
    const elimFases = FASES.filter(f => f !== "Fase de Grupos");
    const toEliminate = new Set<string>();
    for (const fase of elimFases) {
      const faseMatchups = matchups.filter(m => (m.fase || "Fase de Grupos") === fase);
      const faseResults = results.filter(r => (r.fase || "Fase de Grupos") === fase);
      const byPlayer = new Map<string, typeof faseResults[number]>();
      faseResults.forEach(r => byPlayer.set(r.player_id, r));
      for (const m of faseMatchups) {
        const r1 = byPlayer.get(m.player1_id);
        const r2 = byPlayer.get(m.player2_id);
        if (!r1 || !r2) continue;
        let loser: string | null = null;
        if (r1.pontos_jogo > r2.pontos_jogo) loser = m.player2_id;
        else if (r2.pontos_jogo > r1.pontos_jogo) loser = m.player1_id;
        else if (r1.pontos_mesa !== r2.pontos_mesa) {
          if (lowerWins) loser = r1.pontos_mesa < r2.pontos_mesa ? m.player2_id : m.player1_id;
          else loser = r1.pontos_mesa > r2.pontos_mesa ? m.player2_id : m.player1_id;
        }
        if (!loser) continue;
        const p = players.find(pp => pp.id === loser);
        if (p && !p.eliminado) toEliminate.add(loser);
      }
    }
    if (toEliminate.size === 0) return;
    const ids = [...toEliminate];
    supabase.from("players").update({ eliminado: true }).in("id", ids).then(({ error }) => {
      if (error) return;
      toast.success(
        ids.length === 1
          ? "1 jogador eliminado automaticamente após resultado de mata-mata."
          : `${ids.length} jogadores eliminados automaticamente após resultados de mata-mata.`,
      );
      supabase.from("players").select("*").eq("tournament_id", tournamentId).then(({ data }) => {
        if (data) setPlayers(data);
      });
    });
  }, [matchups, results, players, tournamentId]);

  // Detecta automaticamente o campeão quando a Final tem um vencedor.
  useEffect(() => {
    if (campeaoId) return;
    const finalMatchup = matchups.find(m => m.fase === "Final");
    if (!finalMatchup) return;
    const r1 = results.find(r => r.player_id === finalMatchup.player1_id && r.fase === "Final");
    const r2 = results.find(r => r.player_id === finalMatchup.player2_id && r.fase === "Final");
    if (!r1 || !r2) return;
    let winner: string | null = null;
    if (r1.pontos_jogo > r2.pontos_jogo) winner = finalMatchup.player1_id;
    else if (r2.pontos_jogo > r1.pontos_jogo) winner = finalMatchup.player2_id;
    else if (r1.pontos_mesa !== r2.pontos_mesa) {
      if (lowerWins) winner = r1.pontos_mesa < r2.pontos_mesa ? finalMatchup.player1_id : finalMatchup.player2_id;
      else winner = r1.pontos_mesa > r2.pontos_mesa ? finalMatchup.player1_id : finalMatchup.player2_id;
    }
    if (!winner) return;
    (supabase.from("tournaments") as any)
      .update({ campeao_id: winner })
      .eq("id", tournamentId)
      .then(({ error }: { error: any }) => {
        if (error) return;
        setCampeaoId(winner);
        const p = players.find(pp => pp.id === winner);
        toast.success(`🏆 Campeão definido: ${getPlayerDisplayName(p, "vencedor")}!`);
      });
  }, [matchups, results, campeaoId, tournamentId, players]);




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

  const getPlayerNick = (id: string) => getPlayerNickForStandings(players.find(p => p.id === id));
  const getPlayerName = (id: string) => {
    const p = players.find(pp => pp.id === id);
    return (p?.nome_completo || "").trim() || "Desconhecido";
  };

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
        rows: computeStandings(filteredByFase, getPlayerName, getPlayerNick, { lowerWins }),
      }];
    }
    return groups.map(g => ({
      grupo: g,
      rows: computeStandings(
        filteredByFase.filter(r => r.grupo === g),
        getPlayerName,
        getPlayerNick,
        { lowerWins },
      ),
    }));
  }, [filteredByFase, groups, hasAnyGroup, players, lowerWins]);

  const totalRows = sections.reduce((acc, s) => acc + s.rows.length, 0);

  const qualifiers = useMemo(
    () => computeQualifiers(filteredByFase, getPlayerName, getPlayerNick, { ...qualifierOpts, lowerWins }),
    [filteredByFase, players, qualifierOpts, lowerWins],
  );
  const nextFase = nextPhaseName(selectedFase);
  const isGroupsPhase = selectedFase === "Fase de Grupos";

  // Vencedores da fase eliminatória selecionada — formam a lista de classificados
  // para a próxima fase (espelha o comportamento da página pública).
  const elimWinnersQualifiers = useMemo(() => {
    if (isGroupsPhase) return null;
    const faseMatchups = matchups.filter(m => (m.fase || "Fase de Grupos") === selectedFase);
    if (faseMatchups.length === 0) return null;
    const byPlayer = new Map<string, MatchResult>();
    filteredByFase.forEach(r => byPlayer.set(r.player_id, r));
    const qualifiedIds = new Set<string>();
    for (const m of faseMatchups) {
      const r1 = byPlayer.get(m.player1_id);
      const r2 = byPlayer.get(m.player2_id);
      if (!r1 || !r2) continue;
      let w: string | null = null;
      if (r1.pontos_jogo > r2.pontos_jogo) w = m.player1_id;
      else if (r2.pontos_jogo > r1.pontos_jogo) w = m.player2_id;
      else if (r1.pontos_mesa !== r2.pontos_mesa) {
        if (lowerWins) w = r1.pontos_mesa < r2.pontos_mesa ? m.player1_id : m.player2_id;
        else w = r1.pontos_mesa > r2.pontos_mesa ? m.player1_id : m.player2_id;
      }
      if (w) qualifiedIds.add(w);
    }
    // Inclui também os participantes da "Disputa de 3º Lugar" quando cadastrada.
    const thirdPlaceMatchups = matchups.filter(m => (m.fase || "") === "Disputa de 3º Lugar");
    for (const m of thirdPlaceMatchups) {
      if (m.player1_id) qualifiedIds.add(m.player1_id);
      if (m.player2_id) qualifiedIds.add(m.player2_id);
    }
    if (qualifiedIds.size === 0) return null;
    const winnersResults = filteredByFase
      .filter(r => qualifiedIds.has(r.player_id))
      .map(r => ({ ...r, grupo: "" })) as MatchResult[];
    return computeQualifiers(winnersResults, getPlayerName, getPlayerNick, { lowerWins });
  }, [matchups, filteredByFase, selectedFase, isGroupsPhase, players, lowerWins]);

  const showQualifiers = isConcluded && !!nextFase && totalRows > 0 && (
    isGroupsPhase
      ? hasAnyGroup
      : (elimWinnersQualifiers !== null && elimWinnersQualifiers.direct.length > 0)
  );
  const qualifiersToShow = isGroupsPhase ? qualifiers : (elimWinnersQualifiers ?? qualifiers);

  // === Projeção automática das fases eliminatórias ===
  // Conta classificados saídos da Fase de Grupos (usando a regra configurada
  // do torneio, ou o padrão histórico 5+18 quando vazia).
  const grupoResults = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === "Fase de Grupos"),
    [results],
  );
  const grupoQualifiers = useMemo(
    () => computeQualifiers(grupoResults, getPlayerName, getPlayerNick, { ...qualifierOpts, lowerWins }),
    [grupoResults, players, qualifierOpts, lowerWins],
  );
  const classifiedCount = grupoQualifiers.hasGroups
    ? grupoQualifiers.direct.length + grupoQualifiers.repescagem.length
    : grupoQualifiers.direct.length;
  const projection = useMemo(() => projectPhases(classifiedCount), [classifiedCount]);
  const concludedFases = phaseStatuses.filter(p => p.status === "concluida").map(p => p.fase);

  // Banner contextual da fase selecionada
  const selectedFaseMatchups = useMemo(
    () => matchups.filter(m => (m.fase || "Fase de Grupos") === selectedFase),
    [matchups, selectedFase],
  );
  const selectedFasePlayersWithResult = useMemo(() => new Set(
    results
      .filter(r => (r.fase || "Fase de Grupos") === selectedFase)
      .map(r => r.player_id),
  ), [results, selectedFase]);
  const confrontosPendentes = selectedFaseMatchups.filter(
    m => !selectedFasePlayersWithResult.has(m.player1_id) || !selectedFasePlayersWithResult.has(m.player2_id),
  ).length;

  // Sugestão: fase atual concluída + próxima fase ainda sem confrontos
  const projectedNext = projection.find(p => p.fase === selectedFase);
  const projectedAfterCurrent = (() => {
    const i = projection.findIndex(p => p.fase === selectedFase);
    if (i < 0 || i === projection.length - 1) return null;
    return projection[i + 1];
  })();
  const nextHasMatchups = projectedAfterCurrent
    ? matchups.some(m => (m.fase || "Fase de Grupos") === projectedAfterCurrent.fase)
    : false;
  const showGenerateNextHint = isConcluded && projectedAfterCurrent && !nextHasMatchups;
  // Sugestão na própria Fase de Grupos: já concluiu mas a 1ª fase eliminatória ainda não tem confrontos
  const firstElim = projection[0];
  const firstElimHasMatchups = firstElim
    ? matchups.some(m => (m.fase || "Fase de Grupos") === firstElim.fase)
    : false;
  const showGenerateFirstElim =
    selectedFase === "Fase de Grupos" && isConcluded && firstElim && !firstElimHasMatchups;

  const [promoting, setPromoting] = useState(false);

  // Promove jogadores para a próxima fase: gera os matchups sorteados,
  // substituindo qualquer matchup já existente daquela fase.
  const promoteToNextPhase = async (targetFase: string, sourceFase: string) => {
    // Lista de pares já posicionados [player1, player2] na ordem do bracket
    // (slot 1, slot 2, ...). Para a 1ª fase eliminatória, embaralhamos os
    // classificados; para fases seguintes, pareamos vencedores por slot
    // adjacente (slot 1 vs slot 2 → próximo slot 1, etc.) preservando o
    // chaveamento (bracket).
    let pairs: [string, string][] = [];
    if (sourceFase === "Fase de Grupos") {
      const ids = [
        ...grupoQualifiers.direct.map(r => r.playerId),
        ...grupoQualifiers.repescagem.map(r => r.playerId),
      ];
      const shuffled = [...ids];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        pairs.push([shuffled[i], shuffled[i + 1]]);
      }
    } else {
      // Vencedores dos matchups da sourceFase, mantendo a ordem do bracket
      const faseMatchups = matchups
        .filter(m => (m.fase || "Fase de Grupos") === sourceFase)
        .slice()
        .sort((a, b) => {
          const sa = (a as any).bracket_slot ?? 999999;
          const sb = (b as any).bracket_slot ?? 999999;
          if (sa !== sb) return sa - sb;
          return a.created_at.localeCompare(b.created_at);
        });
      const faseResults = results.filter(r => (r.fase || "Fase de Grupos") === sourceFase);
      const byPlayer = new Map<string, typeof faseResults[number]>();
      faseResults.forEach(r => byPlayer.set(r.player_id, r));
      const winners: string[] = [];
      for (const m of faseMatchups) {
        const r1 = byPlayer.get(m.player1_id);
        const r2 = byPlayer.get(m.player2_id);
        if (!r1 || !r2) continue;
        let winner: string | null = null;
        if (r1.pontos_jogo > r2.pontos_jogo) winner = m.player1_id;
        else if (r2.pontos_jogo > r1.pontos_jogo) winner = m.player2_id;
        else if (r1.pontos_mesa > r2.pontos_mesa) winner = m.player1_id;
        else if (r2.pontos_mesa > r1.pontos_mesa) winner = m.player2_id;
        if (winner) winners.push(winner);
      }
      for (let i = 0; i + 1 < winners.length; i += 2) {
        pairs.push([winners[i], winners[i + 1]]);
      }
    }
    if (pairs.length === 0) {
      toast.error("Não há classificados suficientes para gerar os confrontos.");
      return;
    }
    const rows = pairs.map(([a, b], idx) => ({
      tournament_id: tournamentId,
      fase: targetFase,
      grupo: targetFase,
      player1_id: a,
      player2_id: b,
      bracket_slot: idx + 1,
    }));
    setPromoting(true);
    // Substitui qualquer matchup existente da fase alvo
    const { error: delErr } = await supabase
      .from("matchups").delete()
      .eq("tournament_id", tournamentId).eq("fase", targetFase);
    if (delErr) {
      setPromoting(false);
      toast.error("Erro ao limpar confrontos existentes: " + delErr.message);
      return;
    }
    const { error } = await (supabase.from("matchups") as any).insert(rows);
    setPromoting(false);
    if (error) { toast.error("Erro ao gerar confrontos: " + error.message); return; }
    toast.success(`${rows.length} confronto${rows.length === 1 ? "" : "s"} gerado${rows.length === 1 ? "" : "s"} para a ${targetFase}.`);
    // Recarrega matchups
    const { data } = await supabase.from("matchups").select("*").eq("tournament_id", tournamentId);
    if (data) setMatchups(data);
  };






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

  const campeao = campeaoId ? players.find(p => p.id === campeaoId) : null;

  return (
    <div className="space-y-4">
      {campeao && (
        <Alert role="status" className="border-amber-500/50 bg-amber-500/10">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription>
            🏆 <strong>Campeão do torneio:</strong> {getPlayerDisplayName(campeao)}
          </AlertDescription>
        </Alert>
      )}
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

      {projection.length > 0 && (
        <PhaseRoadmap
          projection={projection}
          classifiedCount={classifiedCount}
          currentFase={selectedFase}
          concludedFases={concludedFases}
        />
      )}

      {showGenerateFirstElim && firstElim && (
        <Alert role="status" className="border-primary/40 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong>Fase de Grupos concluída.</strong> Próximo passo: gerar os
                confrontos da <strong>{firstElim.fase}</strong> ({firstElim.from} jogadores).
              </span>
              <Button
                size="sm"
                onClick={() => promoteToNextPhase(firstElim.fase, "Fase de Grupos")}
                disabled={promoting}
              >
                {promoting ? "Gerando..." : `Promover classificados → ${firstElim.fase}`}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {showGenerateNextHint && projectedAfterCurrent && (
        <Alert role="status" className="border-primary/40 bg-primary/5">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                <strong>{selectedFase} concluída.</strong> Próximo passo: gerar os
                confrontos da <strong>{projectedAfterCurrent.fase}</strong> ({projectedAfterCurrent.from} jogadores).
              </span>
              <Button
                size="sm"
                onClick={() => promoteToNextPhase(projectedAfterCurrent.fase, selectedFase)}
                disabled={promoting}
              >
                {promoting ? "Gerando..." : `Promover vencedores → ${projectedAfterCurrent.fase}`}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}


      {!isConcluded && selectedFaseMatchups.length > 0 && confrontosPendentes > 0 && (
        <Alert role="status">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Faltam <strong>{confrontosPendentes}</strong> confronto{confrontosPendentes === 1 ? "" : "s"} para encerrar a {selectedFase}.
            {projectedNext && (
              <> Esta fase deve reduzir de <strong>{projectedNext.from}</strong> para <strong>{projectedNext.to}</strong> jogadores.</>
            )}
          </AlertDescription>
        </Alert>
      )}




      {totalRows === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : (
        (() => {
          const fullList = (
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
          );

          if (showQualifiers) {
            return (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">Classificados para a {nextFase === "Final" ? "grande final e disputa de terceiro" : nextFase}</h2>
                  <QualifiersView qualifiers={qualifiersToShow} />
                </div>
                <Accordion type="single" collapsible className="rounded-md border bg-background px-4">
                  <AccordionItem value="full-list" className="border-b-0">
                    <AccordionTrigger className="text-left">
                      Lista completa de jogadores e suas respectivas posições no torneio
                    </AccordionTrigger>
                    <AccordionContent className="pt-2">
                      {fullList}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            );
          }

          return fullList;
        })()
      )}

      {(() => {
        const elimFases = FASES.filter(f => f !== "Fase de Grupos" && !isSideFase(f));
        // Fase eliminatória mais avançada que já tem confrontos cadastrados.
        let activeElim: string | null = null;
        for (let i = elimFases.length - 1; i >= 0; i--) {
          const f = elimFases[i];
          if (matchups.some(m => (m.fase || "Fase de Grupos") === f)) { activeElim = f; break; }
        }
        if (!activeElim) return null;
        const playerLites = players.map(p => ({
          id: p.id, nome_completo: p.nome_completo, nick_playroom: p.nick_playroom, is_team: (p as any).is_team ?? false,
        }));
        const champion = campeao
          ? { id: campeao.id, nome_completo: campeao.nome_completo, nick_playroom: campeao.nick_playroom, is_team: (campeao as any).is_team ?? false }
          : null;
        return (
          <div className="pt-4">
            <BracketView
              matchups={matchups as any}
              results={results}
              players={playerLites}
              champion={champion}
              hideUnplayed
              title={`Classificação parcial — ${activeElim}`}
            />
          </div>
        );
      })()}
    </div>
  );
}
