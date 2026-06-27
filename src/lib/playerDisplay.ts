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
