CREATE OR REPLACE FUNCTION public.get_moderators_public(_tournament_id uuid)
RETURNS TABLE(user_id uuid, nome text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT pr.user_id, pr.nome
  FROM public.profiles pr
  WHERE pr.user_id IN (
    SELECT DISTINCT mr.registered_by
    FROM public.match_results mr
    WHERE mr.tournament_id = _tournament_id
      AND mr.registered_by IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_moderators_public(uuid) TO anon, authenticated;