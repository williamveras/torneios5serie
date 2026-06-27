DROP FUNCTION IF EXISTS public.get_players_public(uuid);
CREATE OR REPLACE FUNCTION public.get_players_public(_tournament_id uuid)
 RETURNS TABLE(id uuid, tournament_id uuid, nome_completo text, nick_playroom text, grupo text, is_team boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.tournament_id, p.nome_completo, p.nick_playroom, p.grupo, COALESCE(p.is_team, false)
  FROM public.players p
  WHERE p.tournament_id = _tournament_id;
$function$;