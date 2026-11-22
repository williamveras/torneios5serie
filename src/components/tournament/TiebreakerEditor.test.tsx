import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TiebreakerEditor from "./TiebreakerEditor";
import type { Criterion } from "@/lib/tiebreakers";
afterEach(cleanup);
function Fixture() { const [value, setValue] = useState<Criterion[] | null>(null); return <><TiebreakerEditor value={value} h2hFirst={false} onChange={setValue} /><output>{JSON.stringify(value)}</output></>; }
it("adds, reorders and removes criteria accessibly without changing the saved default automatically", () => {
  render(<Fixture />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(screen.queryByText(/Regra atual preservada/)).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("null");
  expect(screen.getByRole("button", { name: "Remover Pontos de vitória" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Descer Pontos de vitória" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Usar pontos → vitórias → penalidades → mesa" }));
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","wins","penalties","table_points"]');
  fireEvent.click(screen.getByRole("button", { name: "Subir Penalidades sofridas" }));
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","penalties","wins","table_points"]');
  fireEvent.click(screen.getByRole("button", { name: "Remover Número de vitórias" }));
  fireEvent.click(screen.getByRole("button", { name: "Adicionar Confronto direto" }));
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","penalties","table_points","head_to_head"]');
  fireEvent.click(screen.getByRole("button", { name: "Restaurar ordem padrão" }));
  expect(screen.getByRole("status")).toHaveTextContent("null");
});
