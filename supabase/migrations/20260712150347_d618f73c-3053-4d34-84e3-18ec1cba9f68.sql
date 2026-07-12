
DROP POLICY IF EXISTS "Anyone can view team members" ON public.team_members;

CREATE OR REPLACE FUNCTION public.get_team_members_public(_tournament_id uuid)
RETURNS TABLE(team_id uuid, "position" int, member_nome text, member_nick text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tm.team_id, tm."position", tm.member_nome, tm.member_nick
  FROM public.team_members tm
  JOIN public.players p ON p.id = tm.team_id
  WHERE p.tournament_id = _tournament_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_members_public(uuid) TO anon, authenticated;
