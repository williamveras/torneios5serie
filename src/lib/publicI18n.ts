import { useSyncExternalStore } from "react";
import catalog from "@/locales/public.json";

export type PublicLanguage = "pt" | "en" | "es" | "fr";
export const languages: Record<PublicLanguage, string> = { pt: "Português", en: "English", es: "Español", fr: "Français" };
const listeners = new Set<() => void>();
const valid = (value: string | null): value is PublicLanguage => !!value && Object.prototype.hasOwnProperty.call(languages, value);
let selected: PublicLanguage = "pt";
try {
  const value = new URLSearchParams(window.location.search).get("lang") || localStorage.getItem("tournament-language");
  if (valid(value)) selected = value;
} catch { /* Storage may be unavailable in private browsers. */ }
export const isPublicPath = (path: string) => path === "/" || path.startsWith("/p/") || path.startsWith("/inscricao/");
export const publicLanguage = (): PublicLanguage => typeof window !== "undefined" && isPublicPath(window.location.pathname) ? selected : "pt";
export function setPublicLanguage(language: PublicLanguage) {
  if (!valid(language)) return;
  selected = language;
  try { localStorage.setItem("tournament-language", language); } catch { /* Keep the in-memory choice. */ }
  const url = new URL(window.location.href);
  url.searchParams.set("lang", language);
  window.history.replaceState(window.history.state, "", url);
  document.documentElement.lang = localeCode();
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const usePublicLanguage = () => useSyncExternalStore(subscribe, publicLanguage, () => "pt" as PublicLanguage);
export const localeCode = () => ({ pt: "pt-BR", en: "en-US", es: "es-ES", fr: "fr-FR" })[publicLanguage()];
export function translate(source: string, language: PublicLanguage, vars: Record<string, string | number> = {}): string {
  const dictionary = language === "pt" ? {} : catalog[language] as Record<string, string>;
  let result = dictionary[source];
  if (result === undefined) {
    const match = source.match(/^(\s*)(.*?)(\s*)$/s)!;
    result = dictionary[match[2]] === undefined ? source : match[1] + dictionary[match[2]] + match[3];
    if (result === source && source.includes("; ")) result = source.split("; ").map(part => translate(part, language)).join("; ");
    const avos = match[2].match(/^(\d+) avos$/i);
    if (avos && language !== "pt") result = ({ en: `Round of ${Number(avos[1]) * 2}`, es: `${avos[1]}avos de final`, fr: `${avos[1]}es de finale` })[language];
  }
  return result.replace(/\{(\w+)\}/g, (token, key) => Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : token).replace(/&ldquo;/g, "“").replace(/&rdquo;/g, "”");
}
export const t = (source: string, vars?: Record<string, string | number>) => translate(source, publicLanguage(), vars);
