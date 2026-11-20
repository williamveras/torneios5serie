import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import RulesContent from "./RulesContent";
import PublicResultNotes from "./PublicResultNotes";
import PublicResults from "./PublicResults";
vi.mock("./TranslatedText", () => ({ default: ({ source, kind = "rules" }: { source: string; kind?: string }) => <div data-kind={kind}>{source}</div> }));
afterEach(cleanup);
it("shows the summary first and opens the full rules on request", () => {
  render(<RulesContent tournamentId="t" regulamento="Full rules" resumo="Short rules" />);
  expect(screen.getByText("Short rules")).toHaveAttribute("data-kind", "rules_summary");
  expect(screen.queryByText("Full rules")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver regulamento completo" }));
  expect(screen.getByText("Full rules")).toBeVisible();
});
it.each([null, "", "  \n "])("keeps full rules without a link when summary is %s", resumo => {
  render(<RulesContent tournamentId="t" regulamento="Full rules" resumo={resumo} />);
  expect(screen.getByText("Full rules")).toBeVisible();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
it("deduplicates shared comments, keeps different notes and escapes markup", () => {
  const { container } = render(<PublicResultNotes results={[
    { id: "b", tournament_id: "t", comentario: "Note" },
    { id: "a", tournament_id: "t", comentario: "Note" },
    { id: "c", tournament_id: "t", comentario: "<script>bad()</script>" },
    { id: "d", tournament_id: "t", comentario: " " },
  ]} />);
  expect(screen.getAllByText("Note")).toHaveLength(1);
  expect(screen.getByText("<script>bad()</script>")).toBeVisible();
  expect(container.querySelector("script")).toBeNull();
});
it.each(["Fase de Grupos", "Final"].flatMap(fase => ["list", "table"].map(mode => [fase, mode])))("shows result notes in %s / %s", (fase, mode) => {
  const rows = ["a", "b"].map((id, i) => ({ id, player_id: id, tournament_id: "t", fase, grupo: "1", rodada: 1, pontos_jogo: i, pontos_mesa: 100, penalidades: "Sem penalidades", comentario: "Shared result note", created_at: "2026-11-20T12:00:00Z", registered_by: null }));
  render(<PublicResults results={rows as any} players={rows.map(r => ({ id: r.id, nome_completo: r.id, nick_playroom: null }))} phaseStatuses={[]} moderators={[]} viewMode={mode as any} defaultExpanded />);
  expect(screen.getAllByText("Shared result note")).toHaveLength(1);
});
