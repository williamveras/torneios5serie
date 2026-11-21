export type Sponsor = { id: string; tournament_id: string; name: string; category: string; website: string | null; enabled: boolean; position: number };
export const sponsorLabels: Record<string, string> = { sponsor: "Patrocínio", master: "Patrocínio master", support: "Apoio" };
export function sponsorWebsite(value: string): string | null {
  if (!value.trim()) return null;
  const url = new URL(value.trim());
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error("Informe um link completo começando com https:// ou http://.");
  return url.href;
}
