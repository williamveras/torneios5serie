BEGIN;
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES('11111111-1111-4111-8111-111111111111','membership@example.invalid','{"site_origin":"https://torneios.5serie.net"}');
INSERT INTO organizations(id,nome,slug,created_by) VALUES('22222222-2222-4222-8222-222222222222','No permission','test-approval-no-access','11111111-1111-4111-8111-111111111111');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $$ BEGIN
 BEGIN PERFORM public.approve_account_with_membership(auth.uid(),'ff5c8e62-4ffb-402d-b998-19d2c77467d3'); RAISE EXCEPTION 'Self approval allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
DO $$ BEGIN
 BEGIN PERFORM public.approve_account_with_membership('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'); RAISE EXCEPTION 'Unmanaged org allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM account_security.requests WHERE user_id='11111111-1111-4111-8111-111111111111')<>'pending' THEN RAISE EXCEPTION 'Failed operation approved account'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT public.approve_account_with_membership('11111111-1111-4111-8111-111111111111','ff5c8e62-4ffb-402d-b998-19d2c77467d3');
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM account_security.requests WHERE user_id='11111111-1111-4111-8111-111111111111')<>'approved' THEN RAISE EXCEPTION 'Approval failed'; END IF;
 IF (SELECT role FROM organization_members WHERE user_id='11111111-1111-4111-8111-111111111111' AND organization_id='ff5c8e62-4ffb-402d-b998-19d2c77467d3') IS DISTINCT FROM 'member'::public.org_role THEN RAISE EXCEPTION 'Membership failed or excess role'; END IF;
 IF (SELECT count(*) FROM account_security.mail_queue WHERE user_id='11111111-1111-4111-8111-111111111111' AND kind='approved')<>1 THEN RAISE EXCEPTION 'Wrong notification count'; END IF;
END $$;
ROLLBACK;
