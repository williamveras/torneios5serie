import { uniqueResultNotes } from "@/lib/resultNotes";
import { t, usePublicLanguage } from "@/lib/publicI18n";
import TranslatedText from "./TranslatedText";

export default function PublicResultNotes({ results }: { results: { id: string; tournament_id: string; comentario?: string | null }[] }) {
  usePublicLanguage();
  const notes = uniqueResultNotes(results);
  if (!notes.length) return null;
  return <section className="mt-3 space-y-2 rounded border p-3 text-sm whitespace-normal break-words">
    <h5 className="font-semibold">{t("Observações")}</h5>
    {notes.map(row => <TranslatedText key={row.id} tournamentId={row.tournament_id} kind="result_note" sourceId={row.id} source={row.comentario!} />)}
  </section>;
}
