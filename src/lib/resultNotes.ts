export function uniqueResultNotes<T extends { id: string; comentario?: string | null }>(results: T[]): T[] {
  const notes = new Map<string, T>();
  for (const result of results) {
    const text = result.comentario?.trim();
    if (!text) continue;
    const previous = notes.get(text);
    if (!previous || result.id < previous.id) notes.set(text, result);
  }
  return [...notes.values()];
}
