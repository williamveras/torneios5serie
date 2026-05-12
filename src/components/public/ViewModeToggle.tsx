import { List, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "list" | "table";

interface Props {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}

export default function ViewModeToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex rounded-md border bg-background p-0.5" role="group" aria-label="Modo de visualização">
      <Button
        type="button"
        size="sm"
        variant={value === "list" ? "default" : "ghost"}
        className="h-8 px-3"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <List className="h-4 w-4 mr-1" /> Lista
      </Button>
      <Button
        type="button"
        size="sm"
        variant={value === "table" ? "default" : "ghost"}
        className="h-8 px-3"
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
      >
        <TableIcon className="h-4 w-4 mr-1" /> Tabela
      </Button>
    </div>
  );
}
