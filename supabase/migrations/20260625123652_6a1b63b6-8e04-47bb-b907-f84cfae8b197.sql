
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS is_captain boolean NOT NULL DEFAULT false;

-- Drop and recreate register_team_via_token to add captain params (optional, default false)
DROP FUNCTION IF EXISTS public.register_team_via_token(text, text, text, text, text, text, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_team_via_token(
  _token text,
  _team_name text,
  _p1_nome text,
  _p1_nick text,
  _p1_email text,
  _p1_whatsapp text,
  _p2_nome text,
  _p2_nick text,
  _p2_email text,
  _p2_whatsapp text,
  _preferencia_horarios text,
  _comentario text,
  _p1_is_captain boolean DEFAULT true,
  _p2_is_captain boolean DEFAULT false
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
  v_p1_cap boolean;
  v_p2_cap boolean;
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

  -- Ensure exactly one captain; default to player 1
  v_p1_cap := COALESCE(_p1_is_captain, false);
  v_p2_cap := COALESCE(_p2_is_captain, false);
  IF v_p1_cap = v_p2_cap THEN
    v_p1_cap := true;
    v_p2_cap := false;
  END IF;

  INSERT INTO public.players (
    tournament_id, nome_completo, nick_playroom, email, whatsapp,
    preferencia_horarios, comentario, is_team
  ) VALUES (
    v_tournament_id,
    v_team_nome,
    v_team_nick,
    CASE WHEN v_p1_cap THEN trim(_p1_email) ELSE trim(_p2_email) END,
    CASE WHEN v_p1_cap THEN NULLIF(trim(COALESCE(_p1_whatsapp, '')), '') ELSE NULLIF(trim(COALESCE(_p2_whatsapp, '')), '') END,
    NULLIF(trim(COALESCE(_preferencia_horarios, '')), ''),
    NULLIF(trim(COALESCE(_comentario, '')), ''),
    true
  )
  RETURNING id INTO v_team_id;

  INSERT INTO public.team_members (team_id, position, member_nome, member_nick, member_email, member_whatsapp, is_captain)
  VALUES
    (v_team_id, 1, trim(_p1_nome), NULLIF(trim(COALESCE(_p1_nick, '')), ''), trim(_p1_email), NULLIF(trim(COALESCE(_p1_whatsapp, '')), ''), v_p1_cap),
    (v_team_id, 2, trim(_p2_nome), NULLIF(trim(COALESCE(_p2_nick, '')), ''), trim(_p2_email), NULLIF(trim(COALESCE(_p2_whatsapp, '')), ''), v_p2_cap);

  RETURN v_team_id;
END;
$function$;
