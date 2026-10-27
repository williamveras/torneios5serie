ALTER TABLE public.players ADD COLUMN result_eliminated boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.sync_result_eliminations(tid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text, 8271));
  WITH decisions AS (
    SELECT CASE
      WHEN a.pontos_jogo>b.pontos_jogo THEN m.player2_id
      WHEN b.pontos_jogo>a.pontos_jogo THEN m.player1_id
      WHEN a.pontos_mesa<>b.pontos_mesa THEN
        CASE WHEN (a.pontos_mesa<b.pontos_mesa)=COALESCE(t.lower_score_wins,false) THEN m.player2_id ELSE m.player1_id END
      ELSE NULL END AS loser
    FROM public.matchups m JOIN public.tournaments t ON t.id=m.tournament_id
    JOIN LATERAL (SELECT r.* FROM public.match_results r WHERE r.tournament_id=tid AND r.fase=m.fase AND r.player_id=m.player1_id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) a ON true
    JOIN LATERAL (SELECT r.* FROM public.match_results r WHERE r.tournament_id=tid AND r.fase=m.fase AND r.player_id=m.player2_id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) b ON true
    WHERE m.tournament_id=tid AND m.fase<>'Fase de Grupos'
  ), desired AS (
    SELECT p.id, EXISTS(SELECT 1 FROM decisions d WHERE d.loser=p.id) AS lost,
      (p.elimination_reason IS NOT NULL OR EXISTS(SELECT 1 FROM public.match_results r WHERE r.tournament_id=tid AND r.player_id=p.id AND r.penalidades ~* 'desistente|eliminado por w[.]o')) AS excluded
    FROM public.players p WHERE p.tournament_id=tid
  )
  UPDATE public.players p SET result_eliminated=d.lost,
    eliminado=CASE WHEN d.lost OR d.excluded THEN true WHEN p.result_eliminated THEN false ELSE p.eliminado END
  FROM desired d WHERE p.id=d.id AND (p.result_eliminated IS DISTINCT FROM d.lost OR
    p.eliminado IS DISTINCT FROM CASE WHEN d.lost OR d.excluded THEN true WHEN p.result_eliminated THEN false ELSE p.eliminado END);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_result_eliminations(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.on_result_elimination_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF TG_OP<>'INSERT' THEN PERFORM public.sync_result_eliminations(OLD.tournament_id); END IF;
  IF TG_OP<>'DELETE' AND (TG_OP='INSERT' OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id) THEN
    PERFORM public.sync_result_eliminations(NEW.tournament_id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.on_result_elimination_change() FROM PUBLIC;
CREATE TRIGGER sync_result_eliminations AFTER INSERT OR UPDATE OR DELETE ON public.match_results FOR EACH ROW EXECUTE FUNCTION public.on_result_elimination_change();
CREATE TRIGGER sync_matchup_eliminations AFTER INSERT OR UPDATE OR DELETE ON public.matchups FOR EACH ROW EXECUTE FUNCTION public.on_result_elimination_change();

CREATE OR REPLACE FUNCTION public.protect_advanced_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  -- Old browser tabs must not overwrite the server's computed result status.
  IF NEW.result_eliminated=OLD.result_eliminated AND NEW.elimination_reason IS NULL
     AND EXISTS(SELECT 1 FROM public.matchups m WHERE m.tournament_id=NEW.tournament_id AND m.fase<>'Fase de Grupos' AND NEW.id IN(m.player1_id,m.player2_id))
     AND NOT EXISTS(SELECT 1 FROM public.match_results r WHERE r.tournament_id=NEW.tournament_id AND r.player_id=NEW.id AND r.penalidades ~* 'desistente|eliminado por w[.]o')
  THEN NEW.eliminado := OLD.result_eliminated OR (OLD.eliminado AND OLD.elimination_reason IS NULL);
  END IF;
  RETURN NEW;
END;
$$;
-- Reconcile existing results once, including losses already marked by the old UI.
DO $$ DECLARE tid uuid; BEGIN
 FOR tid IN SELECT DISTINCT tournament_id FROM public.matchups WHERE fase<>'Fase de Grupos' LOOP
  PERFORM public.sync_result_eliminations(tid);
 END LOOP;
END $$;
NOTIFY pgrst, 'reload schema';
