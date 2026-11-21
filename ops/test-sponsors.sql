BEGIN;
INSERT INTO public.tournament_sponsors(id,tournament_id,name,enabled)
 VALUES('10000000-0000-0000-0000-000000000001','b21eec68-3681-4a37-9740-6dbb8703f61e','Hidden fixture',false);
SET LOCAL ROLE anon;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.tournament_sponsors WHERE name='Hidden fixture') THEN RAISE EXCEPTION 'Hidden sponsor exposed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tournament_sponsors WHERE name='Barão') THEN RAISE EXCEPTION 'Public sponsor missing'; END IF;
 BEGIN
  INSERT INTO public.tournament_sponsors(tournament_id,name) VALUES('b21eec68-3681-4a37-9740-6dbb8703f61e','Forbidden');
  RAISE EXCEPTION 'Anonymous write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
INSERT INTO public.tournament_sponsors(tournament_id,name,category,website)
 VALUES('b21eec68-3681-4a37-9740-6dbb8703f61e','New fixture','support','https://example.com');
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tournament_sponsors WHERE name='Hidden fixture') THEN RAISE EXCEPTION 'Owner cannot read hidden'; END IF;
 UPDATE public.tournament_sponsors SET name='Edited fixture',enabled=true WHERE id='10000000-0000-0000-0000-000000000001';
 IF NOT FOUND THEN RAISE EXCEPTION 'Owner cannot edit'; END IF;
 BEGIN
  UPDATE public.tournament_sponsors SET website='javascript:alert(1)' WHERE id='10000000-0000-0000-0000-000000000001';
  RAISE EXCEPTION 'Unsafe URL accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$ BEGIN
 UPDATE public.tournament_sponsors SET name='Forbidden' WHERE id='10000000-0000-0000-0000-000000000001';
 IF FOUND THEN RAISE EXCEPTION 'Nonmember edit accepted'; END IF;
 DELETE FROM public.tournament_sponsors WHERE id='10000000-0000-0000-0000-000000000001';
 IF FOUND THEN RAISE EXCEPTION 'Nonmember delete accepted'; END IF;
 BEGIN
  INSERT INTO public.tournament_sponsors(tournament_id,name) VALUES('b21eec68-3681-4a37-9740-6dbb8703f61e','Forbidden');
  RAISE EXCEPTION 'Nonmember insert accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
DELETE FROM public.tournament_sponsors WHERE id='10000000-0000-0000-0000-000000000001';
RESET ROLE;
ROLLBACK;
SELECT 'Sponsor visibility, editing and permission checks passed';
