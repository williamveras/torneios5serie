import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TranslationReview, { ScheduleTranslationReview } from "./TranslationReview";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(async () => ({ data: [
  { tournament_id: "t", kind: "rules", source_id: "t", language: "en", source_text: "Regras", translated_text: "Rules text", source_hash: "a", status: "ready" },
  { tournament_id: "t", kind: "rules", source_id: "t", language: "fr", source_text: "Regras", translated_text: "Règlement du tournoi", source_hash: "a", status: "ready" },
  { tournament_id: "t", kind: "rules", source_id: "t", language: "it", source_text: "Regras", translated_text: "Regolamento del torneo", source_hash: "a", status: "ready" },
  { tournament_id: "t", kind: "note", source_id: "n1", language: "en", source_text: "a definir:", translated_text: "To be defined:", source_hash: "b", status: "ready" },
  { tournament_id: "t", kind: "note", source_id: "n2", language: "en", source_text: "Aguardar o moderador", translated_text: "Wait for the moderator", source_hash: "c", status: "ready" },
] })) } }));
afterEach(cleanup);
function mount(ui: React.ReactNode) { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>); }
it("shows only the regulation, even when the tournament has many note translations", async () => {
  mount(<TranslationReview tournamentId="t" />);
  expect(await screen.findByDisplayValue("Rules text")).toBeInTheDocument();
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByDisplayValue("To be defined:")).not.toBeInTheDocument();
  expect(screen.queryByDisplayValue("Wait for the moderator")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "fr" } });
  expect(screen.getByDisplayValue("Règlement du tournoi")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "it" } });
  expect(screen.getByDisplayValue("Regolamento del torneo")).toBeInTheDocument();
});
it("excludes standard notes and reviews only the selected matchup", async () => {
  mount(<ScheduleTranslationReview tournamentId="t" items={[
    { id: "n1", label: "Mesa 1", source: " a definir: " },
    { id: "n2", label: "Final — Mesa 2 — Ana x Bia", source: "Aguardar o moderador" },
  ]} />);
  fireEvent.click(screen.getByText("Revisar traduções das observações dos confrontos"));
  expect(screen.queryByRole("option", { name: "Mesa 1" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Confronto"), { target: { value: "n2" } });
  expect(await screen.findByDisplayValue("Wait for the moderator")).toBeInTheDocument();
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByDisplayValue("Rules text")).not.toBeInTheDocument();
});
