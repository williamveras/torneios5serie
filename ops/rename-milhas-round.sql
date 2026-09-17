-- Correção de nomes do 1000 Milhas após ajuste da contagem da repescagem.
-- Mantém IDs, participantes, resultados e horários. Pode ser executado novamente.
\set ON_ERROR_STOP on
BEGIN;
LOCK TABLE public.matchups, public.match_results, public.phase_status, public.scheduled_draws, public.match_schedule IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE tid uuid := 'b21eec68-3681-4a37-9740-6dbb8703f61e';
BEGIN
  IF EXISTS (SELECT 1 FROM public.matchups WHERE tournament_id=tid AND fase='Terceira Fase') THEN
    IF (SELECT count(*) FROM public.matchups WHERE tournament_id=tid AND fase='Terceira Fase') <> 16
       OR EXISTS (SELECT 1 FROM public.matchups WHERE tournament_id=tid AND fase='16 Avos') THEN
      RAISE EXCEPTION 'A fase mudou: revisar os confrontos antes de renomear';
    END IF;
    UPDATE public.matchups SET fase='16 Avos', grupo=CASE WHEN grupo='Terceira Fase' THEN '16 Avos' ELSE grupo END WHERE tournament_id=tid AND fase='Terceira Fase';
    UPDATE public.match_results SET fase='16 Avos', grupo=CASE WHEN grupo='Terceira Fase' THEN '16 Avos' ELSE grupo END WHERE tournament_id=tid AND fase='Terceira Fase';
    UPDATE public.phase_status SET fase='16 Avos' WHERE tournament_id=tid AND fase='Terceira Fase';
    UPDATE public.scheduled_draws SET fase='16 Avos' WHERE tournament_id=tid AND fase='Terceira Fase';
    UPDATE public.match_schedule SET grupo='16 Avos' WHERE tournament_id=tid AND grupo='Terceira Fase';
  END IF;
END $$;
COMMIT;
SELECT fase,count(*) AS confrontos FROM public.matchups WHERE tournament_id='b21eec68-3681-4a37-9740-6dbb8703f61e' GROUP BY fase ORDER BY fase;
