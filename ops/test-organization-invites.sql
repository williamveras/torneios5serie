BEGIN;
INSERT INTO auth.users(id,email) VALUES('33333333-3333-4333-8333-333333333333','invite-check@example.invalid');
INSERT INTO public.organizations(id,nome,created_by) VALUES('44444444-4444-4444-8444-444444444444','Invitation test','8686f612-56af-487a-b899-1b223f913201');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('44444444-4444-4444-8444-444444444444',auth.uid(),'owner');
SELECT set_config('test.invite',public.send_organization_invite('44444444-4444-4444-8444-444444444444',' INVITE-CHECK@example.invalid ','member')::text,true);
DO $$ BEGIN
 BEGIN
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','member');
  RAISE EXCEPTION 'Direct ID insertion was allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.accept_organization_invite(current_setting('test.invite')::uuid);
  RAISE EXCEPTION 'Wrong email accepted' USING ERRCODE='23514';
 EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',true);
DO $$ BEGIN
 BEGIN PERFORM public.accept_organization_invite(current_setting('test.invite')::uuid); RAISE EXCEPTION 'Pending account accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.send_organization_invite('44444444-4444-4444-8444-444444444444','other@example.invalid','admin'); RAISE EXCEPTION 'Non-manager sent invite'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE account_security.requests SET status='approved' WHERE user_id='33333333-3333-4333-8333-333333333333';
UPDATE account_security.organization_invites SET expires_at=now()-interval '1 day' WHERE id=current_setting('test.invite')::uuid;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN PERFORM public.accept_organization_invite(current_setting('test.invite')::uuid); RAISE EXCEPTION 'Expired invite accepted' USING ERRCODE='23514'; EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
UPDATE account_security.organization_invites SET expires_at=now()+interval '7 days' WHERE id=current_setting('test.invite')::uuid;
SET LOCAL ROLE authenticated;
SELECT public.accept_organization_invite(current_setting('test.invite')::uuid);
SELECT public.accept_organization_invite(current_setting('test.invite')::uuid);
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.organization_members WHERE organization_id='44444444-4444-4444-8444-444444444444' AND user_id='33333333-3333-4333-8333-333333333333' AND role='member')<>1 THEN RAISE EXCEPTION 'Acceptance did not preserve a single membership'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','8686f612-56af-487a-b899-1b223f913201',true);
SELECT set_config('test.revoked',public.send_organization_invite('44444444-4444-4444-8444-444444444444','cancel@example.invalid','admin')::text,true);
SELECT public.manage_organization_invite(current_setting('test.revoked')::uuid,'revoke');
DO $$ BEGIN
 BEGIN UPDATE public.organization_members SET user_id='33333333-3333-4333-8333-333333333333' WHERE organization_id='44444444-4444-4444-8444-444444444444' AND role='owner'; RAISE EXCEPTION 'Membership transferred by ID' USING ERRCODE='23514'; EXCEPTION WHEN raise_exception THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT status FROM account_security.organization_invites WHERE id=current_setting('test.revoked')::uuid)<>'revoked' THEN RAISE EXCEPTION 'Revocation failed'; END IF;
END $$;
ROLLBACK;
SELECT 'Invitation security checks passed; all test records rolled back' AS result;
