
-- 1) Restrict reads on registration_links to authenticated users only
DROP POLICY IF EXISTS "Anyone can view registration links" ON public.registration_links;

CREATE POLICY "Authenticated can view registration links"
ON public.registration_links
FOR SELECT
TO authenticated
USING (true);

REVOKE SELECT ON public.registration_links FROM anon;

-- 2) Remove the old anon INSERT policy on players that relied on reading registration_links
DROP POLICY IF EXISTS "Public can insert players via valid link" ON public.players;

-- 3) SECURITY DEFINER function: validate a registration token (no token returned)
CREATE OR REPLACE FUNCTION public.validate_registration_token(_token text)
RETURNS TABLE(tournament_id uuid, tournament_name text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rl.tournament_id, t.nome, rl.expires_at
  FROM public.registration_links rl
  JOIN public.tournaments t ON t.id = rl.tournament_id
  WHERE rl.token = _token
    AND rl.expires_at > now()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.validate_registration_token(text) TO anon, authenticated;

-- 4) SECURITY DEFINER function: register a player using a valid token
CREATE OR REPLACE FUNCTION public.register_player_via_token(
  _token text,
  _nome_completo text,
  _nick_playroom text,
  _email text,
  _whatsapp text,
  _preferencia_horarios text,
  _comentario text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tournament_id uuid;
  v_player_id uuid;
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
  WHERE rl.token = _token
    AND rl.expires_at > now()
  LIMIT 1;

  IF v_tournament_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token';
  END IF;

  INSERT INTO public.players (
    tournament_id, nome_completo, nick_playroom, email, whatsapp,
    preferencia_horarios, comentario
  ) VALUES (
    v_tournament_id,
    trim(_nome_completo),
    NULLIF(trim(_nick_playroom), ''),
    trim(_email),
    NULLIF(trim(_whatsapp), ''),
    NULLIF(trim(_preferencia_horarios), ''),
    NULLIF(trim(_comentario), '')
  )
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_player_via_token(text, text, text, text, text, text, text) TO anon, authenticated;
