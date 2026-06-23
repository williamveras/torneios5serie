DROP FUNCTION IF EXISTS public.validate_registration_token(text);

CREATE OR REPLACE FUNCTION public.validate_registration_token(_token text)
 RETURNS TABLE(tournament_id uuid, tournament_name text, expires_at timestamp with time zone, modalidade text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT rl.tournament_id, t.nome, rl.expires_at, COALESCE(t.modalidade, 'individual')
  FROM public.registration_links rl
  JOIN public.tournaments t ON t.id = rl.tournament_id
  WHERE rl.token = _token
    AND rl.expires_at > now()
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.register_team_via_token(
  _token text,
  _team_name text,
  _p1_nome text, _p1_nick text, _p1_email text, _p1_whatsapp text,
  _p2_nome text, _p2_nick text, _p2_email text, _p2_whatsapp text,
  _preferencia_horarios text,
  _comentario text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_modalidade text;
  v_team_id uuid;
  v_team_nome text;
  v_team_nick text;
BEGIN
  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _p1_nome IS NULL OR length(trim(_p1_nome)) = 0 OR _p2_nome IS NULL OR length(trim(_p2_nome)) = 0 THEN
    RAISE EXCEPTION 'nome_required';
  END IF;
  IF _p1_email IS NULL OR length(trim(_p1_email)) = 0 OR _p2_email IS NULL OR length(trim(_p2_email)) = 0 THEN
    RAISE EXCEPTION 'email_required';
  END IF;

  SELECT rl.tournament_id, COALESCE(t.modalidade, 'individual')
    INTO v_tournament_id, v_modalidade
  FROM public.registration_links rl
  JOIN public.tournaments t ON t.id = rl.tournament_id
  WHERE rl.token = _token AND rl.expires_at > now()
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  IF v_modalidade <> 'duplas' THEN
    RAISE EXCEPTION 'tournament_is_not_duplas';
  END IF;

  v_team_nome := NULLIF(trim(COALESCE(_team_name, '')), '');
  IF v_team_nome IS NULL THEN
    v_team_nome := trim(_p1_nome) || ' / ' || trim(_p2_nome);
  END IF;

  v_team_nick := CONCAT_WS(' / ',
    NULLIF(trim(COALESCE(_p1_nick, '')), ''),
    NULLIF(trim(COALESCE(_p2_nick, '')), '')
  );
  IF v_team_nick = '' THEN v_team_nick := NULL; END IF;

  INSERT INTO public.players (
    tournament_id, nome_completo, nick_playroom, email, whatsapp,
    preferencia_horarios, comentario, is_team
  ) VALUES (
    v_tournament_id,
    v_team_nome,
    v_team_nick,
    trim(_p1_email),
    NULLIF(trim(COALESCE(_p1_whatsapp, '')), ''),
    NULLIF(trim(COALESCE(_preferencia_horarios, '')), ''),
    NULLIF(trim(COALESCE(_comentario, '')), ''),
    true
  )
  RETURNING id INTO v_team_id;

  INSERT INTO public.team_members (team_id, position, member_nome, member_nick, member_email, member_whatsapp)
  VALUES
    (v_team_id, 1, trim(_p1_nome), NULLIF(trim(COALESCE(_p1_nick, '')), ''), trim(_p1_email), NULLIF(trim(COALESCE(_p1_whatsapp, '')), '')),
    (v_team_id, 2, trim(_p2_nome), NULLIF(trim(COALESCE(_p2_nick, '')), ''), trim(_p2_email), NULLIF(trim(COALESCE(_p2_whatsapp, '')), ''));

  RETURN v_team_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.register_team_via_token(text,text,text,text,text,text,text,text,text,text,text,text) TO anon, authenticated;
