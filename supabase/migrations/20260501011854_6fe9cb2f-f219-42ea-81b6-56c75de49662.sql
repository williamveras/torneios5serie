CREATE OR REPLACE FUNCTION public.get_players_public(_tournament_id uuid)
RETURNS TABLE (
  id uuid,
  tournament_id uuid,
  nome_completo text,
  nick_playroom text,
  grupo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.tournament_id, p.nome_completo, p.nick_playroom, p.grupo
  FROM public.players p
  WHERE p.tournament_id = _tournament_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_players_public(uuid) TO anon, authenticated;