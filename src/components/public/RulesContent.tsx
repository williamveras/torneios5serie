import { useId, useState } from "react";
import { t, usePublicLanguage } from "@/lib/publicI18n";
import TranslatedText from "./TranslatedText";

export default function RulesContent({ tournamentId, regulamento, resumo }: { tournamentId: string; regulamento?: string | null; resumo?: string | null }) {
  usePublicLanguage();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const full = regulamento?.trim() ? <TranslatedText tournamentId={tournamentId} source={regulamento} /> : <p>{t("O regulamento ainda não foi publicado.")}</p>;
  if (!resumo?.trim()) return full;
  return <div className="space-y-4 text-sm leading-relaxed break-words">
    <TranslatedText tournamentId={tournamentId} source={resumo} kind="rules_summary" />
    <button type="button" className="underline text-primary" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>{t(expanded ? "Ocultar regulamento completo" : "Ver regulamento completo")}</button>
    <div id={id} hidden={!expanded}>{expanded && full}</div>
  </div>;
}
