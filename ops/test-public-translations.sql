BEGIN;
-- All fixtures roll back; the production database is not used.
UPDATE public.tournaments SET regulamento='Translation fixture: 32 jogadores.' WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
DO $$ BEGIN
 IF (SELECT count(*) FROM tournament_security.translations WHERE tournament_id='b21eec68-3681-4a37-9740-6dbb8703f61e' AND kind='rules' AND status='pending')<>3 THEN RAISE EXCEPTION 'Missing queue rows'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT public.save_translation_review('b21eec68-3681-4a37-9740-6dbb8703f61e','rules','b21eec68-3681-4a37-9740-6dbb8703f61e','en',md5('Translation fixture: 32 jogadores.'),'Translation fixture: 32 players.');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations('b21eec68-3681-4a37-9740-6dbb8703f61e','en')) x WHERE x->>'text'='Translation fixture: 32 players.' AND x->>'reviewed'='true') THEN RAISE EXCEPTION 'Review missing'; END IF;
END $$;
RESET ROLE;
UPDATE public.tournaments SET regulamento='Changed: 64 jogadores.' WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.save_translation_review('b21eec68-3681-4a37-9740-6dbb8703f61e','rules','b21eec68-3681-4a37-9740-6dbb8703f61e','en',md5('Translation fixture: 32 jogadores.'),'Stale');
  RAISE EXCEPTION 'Stale update was accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='Stale update was accepted' THEN RAISE; END IF;
 END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 BEGIN
  PERFORM public.get_translation_review('b21eec68-3681-4a37-9740-6dbb8703f61e');
  RAISE EXCEPTION 'Unauthorized review exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations('b21eec68-3681-4a37-9740-6dbb8703f61e','en')) x WHERE x->>'text'='Translation fixture: 32 players.') THEN RAISE EXCEPTION 'Stale public text exposed'; END IF;
 BEGIN
  PERFORM 1 FROM tournament_security.translations;
  RAISE EXCEPTION 'Private table exposed';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'translation permission and invalidation checks passed';
