BEGIN;
UPDATE public.tournaments SET regulamento='32 jogadores na terceira fase.' WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT public.save_translation_review('b21eec68-3681-4a37-9740-6dbb8703f61e','rules','b21eec68-3681-4a37-9740-6dbb8703f61e','it',md5('32 jogadores na terceira fase.'),'32 giocatori nella terza fase.');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations('b21eec68-3681-4a37-9740-6dbb8703f61e','it')) x WHERE x->>'text'='32 giocatori nella terza fase.' AND x->>'reviewed'='true') THEN RAISE EXCEPTION 'Italian review not public'; END IF;
END $$;
RESET ROLE;
UPDATE public.tournaments SET regulamento='64 jogadores na terceira fase.' WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations('b21eec68-3681-4a37-9740-6dbb8703f61e','it')) x WHERE x->>'text'='32 giocatori nella terza fase.') THEN RAISE EXCEPTION 'Stale Italian review'; END IF;
END $$;
ROLLBACK;
SELECT 'Italian review and invalidation checks passed';
