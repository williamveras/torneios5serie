ALTER TABLE public.registration_links ADD COLUMN IF NOT EXISTS whatsapp_group_url text;

DROP FUNCTION IF EXISTS public.validate_registration_token(text);

CREATE OR REPLACE FUNCTION public.validate_registration_token(_token text)
 RETURNS TABLE(tournament_id uuid, tournament_name text, expires_at timestamp with time zone, modalidade text, regulamento text, whatsapp_group_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT rl.tournament_id, t.nome, rl.expires_at, COALESCE(t.modalidade, 'individual'), t.regulamento, rl.whatsapp_group_url
  FROM public.registration_links rl
  JOIN public.tournaments t ON t.id = rl.tournament_id
  WHERE rl.token = _token
    AND rl.expires_at > now()
  LIMIT 1;
$function$;