-- Public preview uses the same eligibility validation as scheduled execution.
-- No names, contact information, player IDs or private draw settings are returned.
CREATE FUNCTION public.get_pending_draw_roster(draw_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.scheduled_draws; pool uuid[]; entries jsonb;
BEGIN
  SELECT * INTO d FROM public.scheduled_draws WHERE id=draw_id AND status='pending';
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unavailable'); END IF;
  BEGIN
    pool := tournament_security.draw_pool(d.tournament_id,d.fase);
  EXCEPTION WHEN raise_exception THEN
    RETURN jsonb_build_object('status','updating');
  END;
  IF cardinality(d.player_pool)>0 AND
    (SELECT array_agg(x ORDER BY x) FROM unnest(d.player_pool) x) IS DISTINCT FROM pool THEN
    RETURN jsonb_build_object('status','review');
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'team',coalesce(p.is_team,false),
    'nicks',CASE WHEN p.is_team THEN
      coalesce((SELECT jsonb_agg(nullif(btrim(m.member_nick),'') ORDER BY m.position,m.id)
        FROM public.team_members m WHERE m.team_id=p.id),'[]'::jsonb)
      ELSE jsonb_build_array(nullif(btrim(p.nick_playroom),'')) END
  ) ORDER BY p.id),'[]'::jsonb) INTO entries
  FROM public.players p WHERE p.tournament_id=d.tournament_id AND p.id=ANY(pool);
  RETURN jsonb_build_object('status','ready','participants',entries);
END $$;
REVOKE ALL ON FUNCTION public.get_pending_draw_roster(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pending_draw_roster(uuid) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
