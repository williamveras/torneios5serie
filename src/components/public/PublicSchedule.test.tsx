import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PublicSchedule from "./PublicSchedule";
import type { Tables } from "@/integrations/supabase/types";

afterEach(cleanup);

const players = [
  { id: "a", nome_completo: "Jogador Alfa", nick_playroom: null },
  { id: "b", nome_completo: "Jogador Beta", nick_playroom: null },
];
const matchup = (fase: string) => ({
  id: "match", fase, grupo: fase, player1_id: "a", player2_id: "b",
  published: true, created_at: "2026-10-27T20:00:00Z",
} as Tables<"matchups">);
const schedule = (grupo: string, data_partida = "2020-01-01") => ({
  id: grupo, grupo, data_partida, player1_id: "b", player2_id: "a",
  horario: "19:30:00", created_at: "2026-01-01T00:00:00Z",
} as Tables<"match_schedule">);

describe("public elimination schedule phase isolation", () => {
  it.each(["2", "Primeira Fase"])("keeps new matchup visible despite old schedule in %s", (oldPhase) => {
    render(<PublicSchedule players={players} matchups={[matchup("Segunda Fase")]}
      mainFases={["Segunda Fase"]} schedules={[schedule(oldPhase)]} />);
    expect(screen.getByText(/Jogador Alfa/)).toBeInTheDocument();
    expect(screen.queryByText("19:30")).not.toBeInTheDocument();
  });

  it("uses the current phase schedule even when player order is reversed", () => {
    render(<PublicSchedule players={players} matchups={[matchup("Segunda Fase")]}
      mainFases={["Segunda Fase"]} schedules={[schedule("2"), schedule("Segunda Fase", "2099-01-01")]} />);
    expect(screen.getByText(/Jogador Alfa/)).toBeInTheDocument();
    expect(screen.getByText("19:30")).toBeInTheDocument();
  });

  it("keeps third-place matchup visible independently of old final schedules", () => {
    render(<PublicSchedule players={players} matchups={[matchup("Disputa de 3º Lugar")]}
      mainFases={["Final"]} schedules={[schedule("Final")]} />);
    expect(screen.getByText(/Jogador Alfa/)).toBeInTheDocument();
  });
});
