import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import TiebreakerEditor from "./TiebreakerEditor";
import type { Criterion } from "@/lib/tiebreakers";
afterEach(cleanup);
function Fixture() { const [value, setValue] = useState<Criterion[] | null>(null); return <><TiebreakerEditor value={value} h2hFirst={false} onChange={setValue} /><output>{JSON.stringify(value)}</output></>; }
it("adds, reorders and removes criteria accessibly without changing the saved default automatically", () => {
  render(<Fixture />);
  expect(screen.getByRole("status")).toHaveTextContent("null");
  expect(screen.getByRole("button", { name: "Remover Pontos de vitória" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Descer Pontos de vitória" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Usar pontos → vitórias → penalidades → mesa" }));
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","wins","penalties","table_points"]');
  fireEvent.click(screen.getByRole("button", { name: "Subir Menos penalidades sofridas" }));
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","penalties","wins","table_points"]');
  fireEvent.click(screen.getByRole("button", { name: "Remover Número de vitórias" }));
  fireEvent.change(screen.getByLabelText("Adicionar critério"), { target: { value: "head_to_head" } });
  expect(screen.getByRole("status")).toHaveTextContent('["victory_points","penalties","table_points","head_to_head"]');
  fireEvent.click(screen.getByRole("button", { name: "Restaurar regra anterior" }));
  expect(screen.getByRole("status")).toHaveTextContent("null");
});
