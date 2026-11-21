import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { setPublicLanguage, translate } from "./publicI18n";
import PublicRegistration from "@/pages/PublicRegistration";
import PublicDraw from "@/components/public/PublicDraw";
import catalog from "@/locales/public.json";

vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });

vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn(async (name: string) => ({ data: name === "get_tournament_translations" ? [] : [{ tournament_id: "test", tournament_name: "Torneio Alfa", modalidade: "individual", regulamento: "Regras", regulamento_resumo: "Resumo das regras", expires_at: "2099-01-01" }], error: null })) } }));
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); act(() => setPublicLanguage("pt")); });

it("keeps every placeholder in each reviewed UI translation", () => {
  for (const dictionary of Object.values(catalog)) for (const [source, target] of Object.entries(dictionary)) {
    expect((target.match(/\{\w+\}/g) || []).sort(), source).toEqual((source.match(/\{\w+\}/g) || []).sort());
  }
});
it("translates knockout sizes correctly and preserves player names", () => {
  expect(translate("16 Avos", "en")).toBe("Round of 32");
  expect(translate("16 Avos", "it")).toBe("16esimi di finale");
  expect(translate("Oitavas de Final", "it")).toBe("Ottavi di finale");
  expect(Object.keys(catalog.it).sort()).toEqual(Object.keys(catalog.en).sort());
  expect(translate("{0}, mesa {1}", "en", { "0": "MesaFinal", "1": 4 })).toBe("MesaFinal, table 4");
  window.history.replaceState(null, "", "/p/test");
  act(() => setPublicLanguage("en"));
  render(<PublicDraw fase="Final" players={[{ id: "a", nome_completo: "Final", nick_playroom: null }, { id: "b", nome_completo: "Mesa", nick_playroom: null }]} matchups={[{ id: "m", fase: "Final", grupo: "Final", player1_id: "a", player2_id: "b", published: true } as any]} />);
  expect(screen.getAllByText(/Mesa/).length).toBeGreaterThan(0);
});
it("keeps administration in Portuguese regardless of public language", () => {
  window.history.replaceState(null, "", "/admin");
  act(() => setPublicLanguage("fr"));
  expect(document.documentElement.lang).toBe("pt-BR");
});
it("switches language without losing entered registration details", async () => {
  window.history.replaceState(null, "", "/inscricao/test");
  act(() => setPublicLanguage("pt"));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={["/inscricao/test"]}><Routes><Route path="/inscricao/:token" element={<PublicRegistration />} /></Routes></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByText("Resumo das regras")).toBeVisible();
  expect(screen.queryByText("Regras")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ver regulamento completo" }));
  expect(screen.getByText("Regras")).toBeVisible();
  fireEvent.click(await screen.findByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
  const name = screen.getByLabelText("Nome completo *");
  fireEvent.change(name, { target: { value: "Ana Silva" } });
  act(() => setPublicLanguage("en"));
  expect(screen.getByLabelText(/Full name/)).toHaveValue("Ana Silva");
  expect(screen.getByRole("button", { name: "Submit registration" })).toBeInTheDocument();
  act(() => setPublicLanguage("fr"));
  expect(screen.getByLabelText(/Nom complet/)).toHaveValue("Ana Silva");
  act(() => setPublicLanguage("it"));
  expect(screen.getByLabelText("Nome completo *")).toHaveValue("Ana Silva");
  expect(screen.getByRole("button", { name: "Invia iscrizione" })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe("it-IT");
});
