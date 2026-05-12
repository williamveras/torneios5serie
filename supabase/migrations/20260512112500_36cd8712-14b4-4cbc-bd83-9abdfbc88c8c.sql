
-- Função: sincroniza rodada do agendamento para o confronto correspondente
CREATE OR REPLACE FUNCTION public.sync_matchup_rodada_from_schedule()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.rodada IS NOT NULL THEN
    UPDATE public.matchups m
    SET rodada = NEW.rodada
    WHERE m.tournament_id = NEW.tournament_id
      AND (
        (m.player1_id = NEW.player1_id AND m.player2_id = NEW.player2_id)
        OR (m.player1_id = NEW.player2_id AND m.player2_id = NEW.player1_id)
      )
      AND (m.rodada IS DISTINCT FROM NEW.rodada);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_matchup_rodada ON public.match_schedule;
CREATE TRIGGER trg_sync_matchup_rodada
AFTER INSERT OR UPDATE OF rodada, player1_id, player2_id ON public.match_schedule
FOR EACH ROW
EXECUTE FUNCTION public.sync_matchup_rodada_from_schedule();

-- Sincronização inicial dos dados já existentes
UPDATE public.matchups m
SET rodada = ms.rodada
FROM public.match_schedule ms
WHERE ms.rodada IS NOT NULL
  AND m.tournament_id = ms.tournament_id
  AND (
    (m.player1_id = ms.player1_id AND m.player2_id = ms.player2_id)
    OR (m.player1_id = ms.player2_id AND m.player2_id = ms.player1_id)
  )
  AND m.rodada IS DISTINCT FROM ms.rodada;
