/** Canonical UI labels do not need individual translation review. */
export function standardScheduleNote(source?: string | null): string | null {
  const text = (source || "").trim();
  if (/^a\s+definir\s*[:.!]?$/i.test(text)) return "A definir";
  if (/^w\.?\s*o\.?\s*:?$/i.test(text)) return "W.O";
  return null;
}
