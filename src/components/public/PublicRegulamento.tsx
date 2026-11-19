import TranslatedText from "./TranslatedText";
import { t as tr, usePublicLanguage, localeCode } from "@/lib/publicI18n";
import { Card, CardContent } from "@/components/ui/card";
import { FileText } from "lucide-react";
interface Props {
    regulamento: string | null;
    tournamentId: string;
}
export default function PublicRegulamento({ regulamento, tournamentId }: Props) {
    usePublicLanguage();
    if (!regulamento || !regulamento.trim()) {
        return (<Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40"/>
          <p className="text-sm">{tr("O regulamento ainda n\u00E3o foi publicado.")}</p>
        </CardContent>
      </Card>);
    }
    return (<Card>
      <CardContent className="py-6">
        <div className="whitespace-pre-wrap text-sm leading-relaxed"><TranslatedText tournamentId={tournamentId} source={regulamento} /></div>
      </CardContent>
    </Card>);
}
