// Centraliza a regra de exibição do nome de um participante.
// - Para duplas (is_team = true): mostrar SEMPRE o nome da equipe (nome_completo).
// - Para individuais: nick_playroom quando houver, senão nome_completo.
export interface PlayerDisplayLike {
  nome_completo?: string | null;
  nick_playroom?: string | null;
  is_team?: boolean | null;
}

export function getPlayerDisplayName(p: PlayerDisplayLike | undefined | null, fallback = "—"): string {
  if (!p) return fallback;
  if (p.is_team) return (p.nome_completo || "").trim() || fallback;
  const nick = (p.nick_playroom || "").trim();
  return nick || (p.nome_completo || "").trim() || fallback;
}

export function getPlayerNickForStandings(p: PlayerDisplayLike | undefined | null): string {
  if (!p) return "";
  // Para duplas, evita exibir "nick1 / nick2" — o nome da equipe já sai em playerName.
  if (p.is_team) return "";
  return (p.nick_playroom || "").trim();
}

export function getPlayerFullName(p: PlayerDisplayLike | undefined | null, fallback = "Jogador desconhecido"): string {
  if (!p) return fallback;
  // Em fluxos onde precisamos do "nome real" (não do nick): para duplas o nome é o da equipe.
  return (p.nome_completo || "").trim() || fallback;
}

// Formata membros de uma dupla como "nick1 e nick2" (ou "nick1, nick2 e nick3").
export function joinTeamMembers(members: { nome: string; nick: string | null }[]): string {
  const labels = members
    .map((m) => (m.nick || "").trim() || (m.nome || "").trim())
    .filter(Boolean);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} e ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} e ${labels[labels.length - 1]}`;
}

// Para duplas: retorna `"Nome da equipe" (nick1 e nick2)`. Para individuais: apenas o display name.
export function formatPlayerWithTeam(
  p: PlayerDisplayLike | undefined | null,
  teamMembers: Record<string, { nome: string; nick: string | null }[]> = {},
  fallback = "—",
): string {
  const base = getPlayerDisplayName(p, fallback);
  if (!p?.is_team) return base;
  const id = (p as { id?: string }).id;
  const members = id ? teamMembers[id] || [] : [];
  const joined = joinTeamMembers(members);
  return joined ? `“${base}” (${joined})` : `“${base}”`;
}
