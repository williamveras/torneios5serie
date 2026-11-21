BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
UPDATE public.tournaments SET tie_breaker_order=ARRAY['victory_points','wins','penalties','table_points'] WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
DO $$ BEGIN
 IF (SELECT tie_breaker_order FROM public.tournaments WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e') IS DISTINCT FROM ARRAY['victory_points','wins','penalties','table_points'] THEN RAISE EXCEPTION 'Order did not persist'; END IF;
 BEGIN
  UPDATE public.tournaments SET tie_breaker_order=ARRAY['table_points','victory_points'] WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
  RAISE EXCEPTION 'Primary criterion changed';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.tournaments SET tie_breaker_order=ARRAY['victory_points','wins','wins'] WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
  RAISE EXCEPTION 'Duplicate criterion accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE public.tournaments SET tie_breaker_order=ARRAY['victory_points','unknown'] WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
  RAISE EXCEPTION 'Unknown criterion accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE public.tournaments SET tie_breaker_order=null WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
RESET ROLE;
ROLLBACK;
SELECT 'Tie-break order persistence and validation passed';
