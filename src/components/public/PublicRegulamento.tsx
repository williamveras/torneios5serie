import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";

interface Props {
  regulamento: string | null;
}

export default function PublicRegulamento({ regulamento }: Props) {
  if (!regulamento || !regulamento.trim()) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">O regulamento ainda não foi publicado.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-6">
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{regulamento}</div>
      </CardContent>
    </Card>
  );
}
