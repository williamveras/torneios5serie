
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS max_participants integer;

CREATE OR REPLACE FUNCTION public.enforce_max_participants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mx int;
  cnt int;
BEGIN
  SELECT max_participants INTO mx FROM public.tournaments WHERE id = NEW.tournament_id;
  IF mx IS NOT NULL AND mx > 0 THEN
    SELECT count(*) INTO cnt FROM public.players WHERE tournament_id = NEW.tournament_id;
    IF cnt >= mx THEN
      RAISE EXCEPTION 'max_participants_reached' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_participants ON public.players;
CREATE TRIGGER trg_enforce_max_participants
BEFORE INSERT ON public.players
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_participants();
