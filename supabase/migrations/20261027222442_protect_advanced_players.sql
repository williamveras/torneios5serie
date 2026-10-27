CREATE OR REPLACE FUNCTION public.protect_advanced_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.eliminado AND NOT OLD.eliminado AND NEW.elimination_reason IS NULL
     AND EXISTS (SELECT 1 FROM public.matchups m WHERE m.tournament_id=NEW.tournament_id AND m.fase<>'Fase de Grupos' AND NEW.id IN (m.player1_id,m.player2_id))
     AND NOT EXISTS (SELECT 1 FROM public.match_results r WHERE r.tournament_id=NEW.tournament_id AND r.player_id=NEW.id AND (r.fase<>'Fase de Grupos' OR r.penalidades ~* 'desistente|eliminado por w[.]o'))
  THEN NEW.eliminado := false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_advanced_player() FROM PUBLIC;
CREATE TRIGGER protect_advanced_player BEFORE UPDATE OF eliminado ON public.players FOR EACH ROW EXECUTE FUNCTION public.protect_advanced_player();
