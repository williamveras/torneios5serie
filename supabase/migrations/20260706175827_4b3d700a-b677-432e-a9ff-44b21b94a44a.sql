
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.register_player_via_token(_token text, _nome_completo text, _nick_playroom text, _email text, _whatsapp text, _preferencia_horarios text, _comentario text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tournament_id uuid;
  v_player_id uuid;
  v_nome_n text;
  v_nick_n text;
  v_email_n text;
BEGIN
  IF _token IS NULL OR length(trim(_token)) = 0 THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF _nome_completo IS NULL OR length(trim(_nome_completo)) = 0 THEN
    RAISE EXCEPTION 'nome_required';
  END IF;
  IF _email IS NULL OR length(trim(_email)) = 0 THEN
    RAISE EXCEPTION 'email_required';
  END IF;
  IF length(_nome_completo) > 200 OR length(_email) > 200
     OR COALESCE(length(_nick_playroom), 0) > 100
     OR COALESCE(length(_whatsapp), 0) > 50
     OR COALESCE(length(_preferencia_horarios), 0) > 200
     OR COALESCE(length(_comentario), 0) > 500 THEN
    RAISE EXCEPTION 'input_too_long';
  END IF;

  SELECT rl.tournament_id INTO v_tournament_id
  FROM public.registration_links rl
  WHERE rl.token = _token AND rl.expires_at > now()
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  v_nome_n := lower(btrim(unaccent(_nome_completo)));
  v_email_n := lower(btrim(_email));
  v_nick_n := NULLIF(lower(btrim(unaccent(COALESCE(_nick_playroom, '')))), '');

  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.tournament_id = v_tournament_id
      AND (
        lower(btrim(unaccent(p.nome_completo))) = v_nome_n
        OR (p.email IS NOT NULL AND lower(btrim(p.email)) = v_email_n)
        OR (v_nick_n IS NOT NULL AND p.nick_playroom IS NOT NULL
            AND lower(btrim(unaccent(p.nick_playroom))) = v_nick_n)
      )
  ) THEN
    RAISE EXCEPTION 'duplicate_registration';
  END IF;

  INSERT INTO public.players (
    tournament_id, nome_completo, nick_playroom, email, whatsapp,
    preferencia_horarios, comentario
  ) VALUES (
    v_tournament_id, trim(_nome_completo), NULLIF(trim(_nick_playroom), ''),
    trim(_email), NULLIF(trim(_whatsapp), ''),
    NULLIF(trim(_preferencia_horarios), ''), NULLIF(trim(_comentario), '')
  )
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_team_via_token(_token text, _team_name text, _p1_nome text, _p1_nick text, _p1_email text, _p1_whatsapp text, _p2_nome text, _p2_nick text, _p2_email text, _p2_whatsapp text, _preferencia_horarios text, _comentario text, _p1_is_captain boolean DEFAULT true, _p2_is_captain boolean DEFAULT false)
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
  v_team_nome_n text;
  v_p1_nome_n text;
  v_p2_nome_n text;
  v_p1_nick_n text;
  v_p2_nick_n text;
  v_p1_email_n text;
  v_p2_email_n text;
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

  v_p1_cap := COALESCE(_p1_is_captain, false);
  v_p2_cap := COALESCE(_p2_is_captain, false);
  IF v_p1_cap = v_p2_cap THEN
    v_p1_cap := true;
    v_p2_cap := false;
  END IF;

  v_team_nome_n := lower(btrim(unaccent(v_team_nome)));
  v_p1_nome_n := lower(btrim(unaccent(_p1_nome)));
  v_p2_nome_n := lower(btrim(unaccent(_p2_nome)));
  v_p1_nick_n := NULLIF(lower(btrim(unaccent(COALESCE(_p1_nick, '')))), '');
  v_p2_nick_n := NULLIF(lower(btrim(unaccent(COALESCE(_p2_nick, '')))), '');
  v_p1_email_n := lower(btrim(_p1_email));
  v_p2_email_n := lower(btrim(_p2_email));

  -- Team name uniqueness
  IF EXISTS (
    SELECT 1 FROM public.players p
    WHERE p.tournament_id = v_tournament_id
      AND COALESCE(p.is_team, false) = true
      AND lower(btrim(unaccent(p.nome_completo))) = v_team_nome_n
  ) THEN
    RAISE EXCEPTION 'team_name_taken';
  END IF;

  -- Duplicate member check (email, name, nick)
  IF EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.players p ON p.id = tm.team_id
    WHERE p.tournament_id = v_tournament_id
      AND (
        (tm.member_email IS NOT NULL AND lower(btrim(tm.member_email)) IN (v_p1_email_n, v_p2_email_n))
        OR lower(btrim(unaccent(tm.member_nome))) IN (v_p1_nome_n, v_p2_nome_n)
        OR (tm.member_nick IS NOT NULL AND lower(btrim(unaccent(tm.member_nick))) = ANY (
             ARRAY(SELECT x FROM unnest(ARRAY[v_p1_nick_n, v_p2_nick_n]) x WHERE x IS NOT NULL)
           ))
      )
  ) THEN
    RAISE EXCEPTION 'duplicate_registration';
  END IF;

  INSERT INTO public.players (
    tournament_id, nome_completo, nick_playroom, email, whatsapp,
    preferencia_horarios, comentario, is_team
  ) VALUES (
    v_tournament_id, v_team_nome, v_team_nick,
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
