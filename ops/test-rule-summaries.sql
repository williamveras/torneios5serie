BEGIN;
UPDATE public.tournaments SET regulamento_resumo='Summary fixture' WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
DO $$ DECLARE tid uuid:='b21eec68-3681-4a37-9740-6dbb8703f61e'; rid uuid; tok text; BEGIN
 IF (SELECT count(*) FROM tournament_security.translations WHERE tournament_id=tid AND kind='rules_summary')<>4 THEN RAISE EXCEPTION 'Summary queue missing'; END IF;
 SELECT id INTO STRICT rid FROM public.match_results WHERE tournament_id=tid LIMIT 1;
 UPDATE public.match_results SET comentario='Public note fixture' WHERE id=rid;
 IF (SELECT count(*) FROM tournament_security.translations WHERE source_id=rid AND kind='result_note')<>4 THEN RAISE EXCEPTION 'Result queue missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations(tid,'en')) x WHERE x->>'source_text'='Public note fixture') THEN RAISE EXCEPTION 'Public note missing'; END IF;
 UPDATE public.match_results SET comentario='' WHERE id=rid;
 IF EXISTS(SELECT 1 FROM tournament_security.translations WHERE source_id=rid AND kind='result_note') THEN RAISE EXCEPTION 'Stale notes retained'; END IF;
 SELECT token INTO tok FROM public.registration_links WHERE tournament_id=tid LIMIT 1;
 IF tok IS NOT NULL THEN
  UPDATE public.registration_links SET expires_at=now()+interval '1 day' WHERE token=tok;
  IF (SELECT regulamento_resumo FROM public.validate_registration_token(tok)) IS DISTINCT FROM 'Summary fixture' THEN RAISE EXCEPTION 'Registration summary missing'; END IF;
  UPDATE public.registration_links SET expires_at=now()-interval '1 day' WHERE token=tok;
  IF EXISTS(SELECT 1 FROM public.validate_registration_token(tok)) THEN RAISE EXCEPTION 'Expired token accepted'; END IF;
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT public.save_translation_review('b21eec68-3681-4a37-9740-6dbb8703f61e','rules_summary','b21eec68-3681-4a37-9740-6dbb8703f61e','en',md5('Summary fixture'),'Reviewed summary');
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.get_tournament_translations('b21eec68-3681-4a37-9740-6dbb8703f61e','en')) x WHERE x->>'text'='Reviewed summary') THEN RAISE EXCEPTION 'Anonymous summary missing'; END IF;
END $$;
RESET ROLE;
UPDATE public.tournaments SET regulamento_resumo=null WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e';
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tournament_security.translations WHERE tournament_id='b21eec68-3681-4a37-9740-6dbb8703f61e' AND kind='rules_summary') THEN RAISE EXCEPTION 'Removed summary retained'; END IF;
END $$;
ROLLBACK;
SELECT 'summary and result note checks passed';
