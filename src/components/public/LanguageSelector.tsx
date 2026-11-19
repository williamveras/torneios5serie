import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isPublicPath, languages, localeCode, setPublicLanguage, usePublicLanguage, t, type PublicLanguage } from "@/lib/publicI18n";

export default function LanguageSelector() {
  const language = usePublicLanguage();
  const { pathname } = useLocation();
  useEffect(() => { document.documentElement.lang = localeCode(); }, [pathname, language]);
  if (!isPublicPath(pathname)) return null;
  return <div className="flex justify-end px-4 py-2 border-b bg-background">
    <label className="flex items-center gap-2 text-sm"><span aria-hidden="true">🌐</span> {t("Idioma")}
      <select className="rounded border bg-background p-2" value={language} onChange={e => setPublicLanguage(e.target.value as PublicLanguage)}>
        {Object.entries(languages).map(([code, name]) => <option key={code} value={code} lang={code}>{name}</option>)}
      </select>
    </label>
  </div>;
}
