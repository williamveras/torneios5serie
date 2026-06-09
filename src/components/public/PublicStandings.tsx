import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { AlertTriangle, CheckCircle2, BarChart3, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { FASES } from "@/lib/constants";
import { computeStandings } from "@/lib/standings";
import { computeQualifiers, nextPhaseName } from "@/lib/qualifiers";
import { projectPhases } from "@/lib/phaseProjection";
import PhaseRoadmap from "@/components/PhaseRoadmap";
import QualifiersView from "@/components/QualifiersView";
import type { ViewMode } from "./ViewModeToggle";
import type { Tables } from "@/integrations/supabase/types";

type MatchResult = Tables<"match_results">;
type PhaseStatus = Tables<"phase_status">;

type Matchup = Tables<"matchups">;

interface PlayerLite {
  id: string;
  nome_completo: string;
  nick_playroom: string | null;
}

interface Props {
  results: MatchResult[];
  players: PlayerLite[];
  phaseStatuses: PhaseStatus[];
  matchups?: Matchup[];
  viewMode?: ViewMode;
}

const naturalGroupSort = (a: string, b: string) => {
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b);
};

const hasGroup = (g: string | null | undefined) => !!g && g.trim() !== "";
const noWrapText = "public-nowrap";
const scrollLine = "public-scroll-line";
const compactCardPadding = "p-3 min-[360px]:p-4";
const keepTogether = (text: string | number) =>
  String(text).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");

export default function PublicStandings({ results, players, phaseStatuses, matchups = [], viewMode = "list" }: Props) {
  // Default fase: latest concluded phase (so the public view follows the tournament progression).
  const latestConcludedFase = useMemo(() => {
    for (let i = FASES.length - 1; i >= 0; i--) {
      const f = FASES[i];
      if (phaseStatuses.find(p => p.fase === f)?.status === "concluida") return f;
    }
    return "Fase de Grupos";
  }, [phaseStatuses]);
  const [selectedFase, setSelectedFase] = useState<string>(latestConcludedFase);
  const [userPickedFase, setUserPickedFase] = useState(false);
  // Keep selected fase in sync with progression until the user manually changes it.
  useEffect(() => {
    if (!userPickedFase) setSelectedFase(latestConcludedFase);
  }, [latestConcludedFase, userPickedFase]);

  const playerMap = useMemo(() => {
    const m = new Map<string, PlayerLite>();
    players.forEach(p => m.set(p.id, p));
    return m;
  }, [players]);

  const getPlayerName = (id: string) => playerMap.get(id)?.nome_completo || "Jogador desconhecido";
  const getPlayerNick = (id: string) => playerMap.get(id)?.nick_playroom || "";

  const availableFases = useMemo(() => {
    const fases = [...new Set(results.map(r => r.fase || "Fase de Grupos"))];
    return FASES.filter(f => fases.includes(f));
  }, [results]);

  const filteredByFase = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === selectedFase),
    [results, selectedFase],
  );

  const hasAnyGroup = useMemo(() => filteredByFase.some(r => hasGroup(r.grupo)), [filteredByFase]);

  const groups = useMemo(
    () => [...new Set(filteredByFase.filter(r => hasGroup(r.grupo)).map(r => r.grupo))].sort(naturalGroupSort),
    [filteredByFase],
  );

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

  const phaseStatus = phaseStatuses.find(p => p.fase === selectedFase)?.status || "em_andamento";
  const isInProgress = phaseStatus === "em_andamento" && totalRows > 0;
  const isConcluded = phaseStatus === "concluida";

  const qualifiers = useMemo(
    () => computeQualifiers(filteredByFase, getPlayerName, getPlayerNick),
    [filteredByFase, players],
  );
  const nextFase = nextPhaseName(selectedFase);
  const showQualifiers = isConcluded && hasAnyGroup && !!nextFase && totalRows > 0;

  // Projeção de fases eliminatórias (visível na fase de grupos para mostrar o roadmap completo).
  const grupoResults = useMemo(
    () => results.filter(r => (r.fase || "Fase de Grupos") === "Fase de Grupos"),
    [results],
  );
  const grupoQualifiers = useMemo(
    () => computeQualifiers(grupoResults, getPlayerName, getPlayerNick),
    [grupoResults, players],
  );
  const classifiedCount = grupoQualifiers.hasGroups
    ? grupoQualifiers.direct.length + grupoQualifiers.repescagem.length
    : grupoQualifiers.direct.length;
  const projection = useMemo(() => projectPhases(classifiedCount), [classifiedCount]);
  const concludedFases = phaseStatuses.filter(p => p.status === "concluida").map(p => p.fase);

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

  const renderStandingsSections = () => (
    viewMode === "table" ? (
      <div className="space-y-6">
        {sections.map(sec => (
          <section key={sec.grupo || "__no_group__"}>
            {hasAnyGroup && (
              <h3 className="font-semibold text-lg mb-2">Grupo {sec.grupo}</h3>
            )}
            <div className="rounded-md border overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Jogador</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Pts. vitória</TableHead>
                    <TableHead className="text-right whitespace-nowrap">Pts. mesa</TableHead>
                    <TableHead className="whitespace-nowrap">Penalidades</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sec.rows.map(s => {
                    const displayName = s.nick || s.playerName;
                    return (
                      <TableRow key={s.playerId} className={s.hasPenalty ? "bg-destructive/5" : ""}>
                        <TableCell className="font-bold tabular-nums">{s.position}º</TableCell>
                        <TableCell className={`font-medium ${noWrapText}`}>{displayName}</TableCell>
                        <TableCell className={`text-right tabular-nums ${noWrapText}`}>{s.pontosJogo}</TableCell>
                        <TableCell className={`text-right tabular-nums ${noWrapText}`}>{s.pontosMesa}</TableCell>
                        <TableCell className={`${noWrapText} ${s.hasPenalty ? "text-destructive" : "text-muted-foreground"}`}>
                          {s.penalidades}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>
        ))}
      </div>
    ) : (
      <div className="space-y-6">
        {sections.map(sec => (
          <section key={sec.grupo || "__no_group__"}>
            {hasAnyGroup && (
              <h3 className="font-semibold text-lg mb-2">
                Grupo {sec.grupo}
              </h3>
            )}
            <ol
              className="space-y-2"
              aria-label={
                hasAnyGroup
                  ? `Classificação do grupo ${sec.grupo}`
                  : `Classificação — ${selectedFase}`
              }
            >
              {sec.rows.map(s => {
                const displayName = s.nick || s.playerName;
                return (
                  <li
                    key={s.playerId}
                    className={`rounded-md border bg-background flex items-start gap-3 min-w-0 overflow-hidden ${compactCardPadding} ${s.hasPenalty ? "bg-destructive/5" : ""}`}
                  >
                    <div
                      className="font-bold tabular-nums text-lg min-w-[2.5rem]"
                      aria-label={`Posição ${s.position}`}
                    >
                      {s.position}º
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${scrollLine}`}><span className="public-line-content">{keepTogether(displayName)}</span></p>
                      <p className={`text-sm mt-0.5 ${scrollLine}`}>
                        <span className="public-line-content">{keepTogether(`${s.pontosJogo} pontos de vitória, ${s.pontosMesa} pontos de mesa.`)}</span>
                      </p>
                      <p className={`text-sm ${scrollLine} ${s.hasPenalty ? "text-destructive" : "text-muted-foreground"}`}>
                        <span className="public-line-content">{keepTogether(`Penalidades: ${s.penalidades}.`)}</span>
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-4">
      {totalRows > 0 && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={exportToXlsx}>
            <Download className="h-4 w-4 mr-1" /> Exportar planilha
          </Button>
        </div>
      )}
      {projection.length > 0 && (
        <PhaseRoadmap
          projection={projection}
          classifiedCount={classifiedCount}
          currentFase={selectedFase}
          concludedFases={concludedFases}
        />
      )}
      {totalRows > 0 && (
        isInProgress ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10" role="status">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <strong>Fase em andamento</strong> — esta classificação é parcial e pode mudar até o encerramento da fase.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-500/50 bg-green-500/10" role="status">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription>
              {showQualifiers ? (
                <div className="space-y-2">
                  <p><strong>Fase encerrada</strong> — classificação oficial.</p>
                  <p>Abaixo, segue a lista de classificados para a {nextFase}.</p>
                  <p>
                    Se você deseja visualizar a lista completa dos jogadores e suas respectivas posições, até mesmo os que não passaram, pode procurar aqui mesmo, no fim dessa página, a guia "lista completa de jogadores e suas respectivas posições no torneio."
                  </p>
                </div>
              ) : (
                <><strong>Fase encerrada</strong> — classificação oficial.</>
              )}
            </AlertDescription>
          </Alert>
        )
      )}

      {totalRows === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
            <p>Nenhum resultado registrado para esta fase.</p>
          </CardContent>
        </Card>
      ) : showQualifiers ? (
        <div className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Classificados para a {nextFase}</h2>
            <QualifiersView qualifiers={qualifiers} viewMode={viewMode} />
          </div>
          <Accordion type="single" collapsible className="rounded-md border bg-background px-4">
            <AccordionItem value="full-list" className="border-b-0">
              <AccordionTrigger className="text-left">
                Lista completa de jogadores e suas respectivas posições no torneio
              </AccordionTrigger>
              <AccordionContent className="pt-2">
                {renderStandingsSections()}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ) : (
        renderStandingsSections()
      )}
    </div>
  );
}

