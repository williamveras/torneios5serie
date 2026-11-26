import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PendingDrawRoster from "./PendingDrawRoster";
import PublicDraw from "./PublicDraw";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function show(node: React.ReactNode, data: unknown) {
  vi.mocked(supabase.rpc).mockResolvedValue({ data, error: null } as any);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}>{node}</QueryClientProvider>);
}
it("sorts nicknames, keeps doubles together and counts entries without exposing names", async () => {
  show(<PendingDrawRoster drawId="draw"/>, { status: "ready", participants: [
    { team: false, nicks: ["Zorro"], nome_completo: "Private name" },
    { team: true, nicks: ["Alpha", "Beta"] },
    { team: false, nicks: [null], nome_completo: "Another private name" },
  ] });
  expect(await screen.findByText("Total de participantes: 3")).toBeVisible();
  expect(screen.getAllByRole("listitem").map(n => n.textContent)).toEqual(["Alpha / Beta", "Nick não informado", "Zorro"]);
  expect(screen.queryByText(/private name/i)).not.toBeInTheDocument();
});
it.each(["updating", "review", "unavailable"])("does not show stale participants when %s", async status => {
  show(<PendingDrawRoster drawId="draw"/>, { status, participants: [{ nicks: ["StaleNick"] }] });
  expect(await screen.findByRole("status")).toBeVisible();
  expect(screen.queryByText("StaleNick")).not.toBeInTheDocument();
});
it("shows the upcoming roster even with published matches from an earlier round", async () => {
  show(<PublicDraw fase="Fase de Grupos" players={[]} matchups={[{ id: "m", fase: "Fase de Grupos", grupo: "1", player1_id: "a", player2_id: "b", published: true } as any]}
    scheduledDraws={[{ id: "draw", fase: "Fase de Grupos", scheduled_at: "2099-01-01", status: "pending" }]}/>,
    { status: "ready", participants: [{ team: false, nicks: ["FutureNick"] }] });
  expect(await screen.findByText("FutureNick")).toBeVisible();
  expect(within(screen.getByRole("region", { name: "Participantes do sorteio" })).getByRole("listitem")).toHaveTextContent("FutureNick");
});
