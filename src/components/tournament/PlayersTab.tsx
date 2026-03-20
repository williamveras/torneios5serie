import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import type { Tables } from "@/integrations/supabase/types";

type Player = Tables<"players">;

interface Props { tournamentId: string; }

export default function PlayersTab({ tournamentId }: Props) {
  const [players, setPlayers] = useState<Player[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = async () => {
    const { data } = await supabase.from("players").select("*").eq("tournament_id", tournamentId).order("nome_completo");
    if (data) setPlayers(data);
  };

  useEffect(() => { fetchPlayers(); }, [tournamentId]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);

    if (rows.length === 0) { toast.error("Planilha vazia"); return; }

    // Map columns flexibly
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
