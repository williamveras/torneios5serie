BEGIN;
-- Run after migration, inside a transaction; all test users and data roll back.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ('11111111-1111-4111-8111-111111111111','approval-test@example.invalid','{"nome":"Teste de aprovação","status":"approved","is_admin":true}');
DO $$ BEGIN
 IF (SELECT status FROM account_security.requests WHERE user_id='11111111-1111-4111-8111-111111111111')<>'pending' THEN RAISE EXCEPTION 'Signup not pending'; END IF;
 IF (SELECT count(*) FROM account_security.mail_queue WHERE user_id='11111111-1111-4111-8111-111111111111')<>1 THEN RAISE EXCEPTION 'Missing notification'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF public.account_access_status()->>'status'<>'pending' THEN RAISE EXCEPTION 'Metadata bypass'; END IF;
 IF (public.account_access_status()->>'is_admin')::boolean THEN RAISE EXCEPTION 'Admin escalation'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles) OR EXISTS(SELECT 1 FROM public.team_members) THEN RAISE EXCEPTION 'Pending data access'; END IF;
 BEGIN
  INSERT INTO public.organizations(id,nome,created_by) VALUES(gen_random_uuid(),'Blocked org',auth.uid());
  RAISE EXCEPTION 'Pending account could write';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.account_approval_requests(); RAISE EXCEPTION 'Non-admin could list'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.decide_account_approval(auth.uid(),'approved'); RAISE EXCEPTION 'Self approval'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT public.decide_account_approval('11111111-1111-4111-8111-111111111111','approved');
DO $$ BEGIN
 BEGIN
  PERFORM public.decide_account_approval('11111111-1111-4111-8111-111111111111','rejected');
  RAISE EXCEPTION 'Duplicate decision accepted' USING ERRCODE='23514';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 IF public.account_access_status()->>'status'<>'approved' THEN RAISE EXCEPTION 'Approval failed'; END IF;
 IF EXISTS(SELECT 1 FROM public.tournaments) THEN RAISE EXCEPTION 'Approval gave organization access'; END IF;
END $$;
RESET ROLE;
INSERT INTO auth.users(id,email) VALUES('22222222-2222-4222-8222-222222222222','reject-test@example.invalid');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT public.decide_account_approval('22222222-2222-4222-8222-222222222222','rejected');
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
DO $$ BEGIN
 IF public.account_access_status()->>'status'<>'rejected' OR account_security.is_approved() THEN RAISE EXCEPTION 'Rejection failed'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM pg_policies WHERE policyname='approved_account_required')<>13 THEN RAISE EXCEPTION 'Missing table guard'; END IF;
 IF (SELECT count(*) FROM account_security.mail_queue WHERE user_id='11111111-1111-4111-8111-111111111111')<>2 THEN RAISE EXCEPTION 'Wrong decision notifications'; END IF;
END $$;
ROLLBACK;
SELECT 'Approval authorization checks passed; test data rolled back' AS result;
