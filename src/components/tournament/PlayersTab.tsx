import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Users, Shuffle, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

interface Props { tournamentId: string; }

function suggestGroupSize(total: number): number {
  if (total <= 3) return total;
  let best = 4;
  let bestRemainder = total;
  for (let size = 3; size <= 8; size++) {
    const remainder = total % size;
    if (remainder < bestRemainder || (remainder === bestRemainder && size > best)) {
      bestRemainder = remainder;
      best = size;
    }
  }
  return best;
}

function distributeIntoGroups(players: Player[], perGroup: number): Map<string, string> {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const numGroups = Math.ceil(shuffled.length / perGroup);
  const map = new Map<string, string>();
  shuffled.forEach((p, i) => {
    const groupIndex = i % numGroups;
    const groupLetter = String.fromCharCode(65 + groupIndex);
    map.set(p.id, groupLetter);
  });
  return map;
}

export default function PlayersTab({ tournamentId }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [perGroup, setPerGroup] = useState<string>("4");
  const [sorting, setSorting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = async () => {
    const { data } = await supabase.from("players").select("*").eq("tournament_id", tournamentId).order("grupo").order("nome_completo");
    if (data) setPlayers(data);
  };

  useEffect(() => { fetchPlayers(); }, [tournamentId]);

  const hasGroups = players.some(p => p.grupo);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) { toast.error("Planilha vazia"); return; }

    const findCol = (row: Record<string, string>, keywords: string[]) => {
      const key = Object.keys(row).find(k => keywords.some(kw => k.toLowerCase().includes(kw)));
      return key ? String(row[key] ?? "").trim() : "";
    };

    const playersToInsert = rows.map(row => ({
      tournament_id: tournamentId,
      nome_completo: findCol(row, ["nome"]) || Object.values(row)[0]?.toString() || "Sem nome",
      nick_playroom: findCol(row, ["nick", "playroom"]) || null,
      whatsapp: findCol(row, ["whatsapp", "telefone", "celular", "ddd"]) || null,
      preferencia_horarios: findCol(row, ["horário", "horario", "preferência", "preferencia"]) || null,
      comentario: findCol(row, ["comentário", "comentario", "adicional", "observação"]) || null,
    }));

    const { error } = await supabase.from("players").insert(playersToInsert);
    if (error) {
      toast.error("Erro ao importar jogadores");
    } else {
      toast.success(`${playersToInsert.length} jogadores importados!`);
      fetchPlayers();
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("players").delete().eq("id", id);
    if (error) toast.error("Erro ao remover jogador");
    else fetchPlayers();
  };

  const handleSuggest = () => {
    const suggestion = suggestGroupSize(players.length);
    setPerGroup(String(suggestion));
    toast.info(`Sugestão: ${suggestion} jogadores por grupo (${Math.ceil(players.length / suggestion)} grupos)`);
  };

  const handleSortear = async () => {
    const size = parseInt(perGroup);
    if (!size || size < 2) { toast.error("Informe pelo menos 2 jogadores por grupo"); return; }
    if (players.length < size) { toast.error("Poucos jogadores para essa configuração"); return; }

    setSorting(true);
    const distribution = distributeIntoGroups(players, size);

    // Update each player's grupo
    const updates = Array.from(distribution.entries()).map(([id, grupo]) =>
      supabase.from("players").update({ grupo }).eq("id", id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    if (hasError) {
      toast.error("Erro ao sortear grupos");
    } else {
      const numGroups = Math.ceil(players.length / size);
      toast.success(`Jogadores distribuídos em ${numGroups} grupo(s)!`);
      fetchPlayers();
    }
    setSorting(false);
  };

  const handleClearGroups = async () => {
    setSorting(true);
    const updates = players.map(p =>
      supabase.from("players").update({ grupo: null }).eq("id", p.id)
    );
    await Promise.all(updates);
    toast.success("Grupos limpos!");
    fetchPlayers();
    setSorting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{players.length} participante(s)</p>
        <div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Importar Planilha
          </Button>
        </div>
      </div>

      {/* Sortear Grupos */}
      {players.length >= 2 && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <p className="text-sm font-medium">Distribuição de Grupos</p>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="space-y-1">
                <Label className="text-xs">Jogadores por grupo</Label>
                <Input
                  type="number"
                  min={2}
                  max={players.length}
                  value={perGroup}
                  onChange={e => setPerGroup(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button variant="outline" size="sm" onClick={handleSuggest}>
                <Lightbulb className="h-4 w-4 mr-1" /> Sugerir
              </Button>
              <Button size="sm" onClick={handleSortear} disabled={sorting}>
                <Shuffle className="h-4 w-4 mr-1" /> {sorting ? "Sorteando..." : "Sortear Grupos"}
              </Button>
              {hasGroups && (
                <Button variant="ghost" size="sm" onClick={handleClearGroups} disabled={sorting}>
                  Limpar Grupos
                </Button>
              )}
            </div>
            {hasGroups && (
              <p className="text-xs text-muted-foreground">
                Os grupos já foram definidos. Clique em "Sortear Grupos" para refazer o sorteio.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {players.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Nenhum participante cadastrado.</p>
            <p className="text-sm">Importe uma planilha do Google Forms para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Grupo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Nick</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Horários</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    {p.grupo ? (
                      <Badge variant="secondary">Grupo {p.grupo}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.nome_completo}</TableCell>
                  <TableCell>{p.nick_playroom || "—"}</TableCell>
                  <TableCell>{p.whatsapp || "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{p.preferencia_horarios || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
