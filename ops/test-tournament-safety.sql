\set ON_ERROR_STOP on
BEGIN;
CREATE FUNCTION pg_temp.check_true(ok boolean,msg text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%',msg; END IF; END $$;
-- All fixtures and tests are rolled back; no messages are sent.
INSERT INTO auth.users(id,email) VALUES('10000000-0000-0000-0000-000000000001','owner@safety.invalid'),('10000000-0000-0000-0000-000000000002','admin@safety.invalid');
INSERT INTO account_security.requests(user_id,status) VALUES('10000000-0000-0000-0000-000000000001','approved'),('10000000-0000-0000-0000-000000000002','approved') ON CONFLICT(user_id) DO UPDATE SET status='approved';
INSERT INTO organizations(id,nome,slug,created_by) VALUES('20000000-0000-0000-0000-000000000001','Test A','test-safety-a','10000000-0000-0000-0000-000000000001'),('20000000-0000-0000-0000-000000000002','Test B','test-safety-b','10000000-0000-0000-0000-000000000001');
INSERT INTO organization_members(organization_id,user_id,role) VALUES
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','admin'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','owner');
INSERT INTO tournaments(id,nome,data_inicio,created_by,organization_id,elimination_only) VALUES
('30000000-0000-0000-0000-000000000001','Test A',current_date,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',true),
('30000000-0000-0000-0000-000000000002','Test B',current_date,'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002',true);
INSERT INTO players(id,tournament_id,nome_completo) VALUES
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','A'),
('40000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','B'),
('40000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','C');
INSERT INTO team_members(team_id,member_nome,position) VALUES('40000000-0000-0000-0000-000000000001','Local',1),('40000000-0000-0000-0000-000000000003','Other org',1);
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM team_members WHERE team_id IN('40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000003')),'Team RLS leaked another organization');
UPDATE team_members SET member_nome='Updated' WHERE team_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true((SELECT member_nome='Updated' FROM team_members WHERE team_id='40000000-0000-0000-0000-000000000001'),'Allowed update failed');
DO $$ BEGIN
 BEGIN INSERT INTO team_members(team_id,member_nome,position) VALUES('40000000-0000-0000-0000-000000000003','Attack',2); RAISE EXCEPTION 'Cross-org insert allowed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN UPDATE organization_members SET role='owner' WHERE user_id=auth.uid() AND organization_id='20000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'Self promotion allowed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Self promotion allowed' THEN RAISE; END IF; END;
 BEGIN DELETE FROM organization_members WHERE role='owner' AND organization_id='20000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'Admin removed owner'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Admin removed owner' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN DELETE FROM organization_members WHERE role='owner' AND organization_id='20000000-0000-0000-0000-000000000001'; RAISE EXCEPTION 'Last owner removed'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Last owner removed' THEN RAISE; END IF; END;
END $$;
UPDATE players SET eliminado=true,elimination_reason='withdrawal' WHERE id='40000000-0000-0000-0000-000000000001';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
INSERT INTO matchups(tournament_id,fase,grupo,player1_id,player2_id,published) VALUES('30000000-0000-0000-0000-000000000001','Final','Final','40000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000002',false);
SET LOCAL ROLE anon;
SELECT pg_temp.check_true((SELECT count(*)=0 FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000001'),'Draft disclosed');
SELECT pg_temp.check_true((SELECT eliminado AND elimination_reason='withdrawal' FROM get_players_public('30000000-0000-0000-0000-000000000001') WHERE id='40000000-0000-0000-0000-000000000001'),'Public withdrawal missing');
RESET ROLE;
UPDATE matchups SET published=true WHERE tournament_id='30000000-0000-0000-0000-000000000001';
SET LOCAL ROLE anon;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000001'),'Published match hidden');
RESET ROLE;
INSERT INTO match_results(tournament_id,player_id,fase,grupo,rodada,pontos_jogo,pontos_mesa) VALUES('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Final','Final',1,3,500);
DO $$ BEGIN
 BEGIN INSERT INTO match_results(tournament_id,player_id,fase,grupo,rodada) VALUES('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Final','Changed',2); RAISE EXCEPTION 'Duplicate accepted'; EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
SELECT pg_temp.check_true((SELECT mesa_numero=1 FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000001'),'Mesa missing');
-- Scheduler refuses odd/incomplete pools and never replaces published matches.
INSERT INTO players(id,tournament_id,nome_completo) VALUES
('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000002','D'),
('40000000-0000-0000-0000-000000000005','30000000-0000-0000-0000-000000000002','E');
UPDATE tournament_security.lifecycle SET dirty=false,projection='{"conflicts":[],"eligible":{"Final":["40000000-0000-0000-0000-000000000003","40000000-0000-0000-0000-000000000004","40000000-0000-0000-0000-000000000005"]},"expected":{"Final":3}}' WHERE tournament_id='30000000-0000-0000-0000-000000000002';
INSERT INTO scheduled_draws(id,tournament_id,fase,mode,scheduled_at) VALUES('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','Final','geral',now()-interval '1 minute');
SELECT execute_scheduled_draws();
SELECT pg_temp.check_true((SELECT status='failed' AND error_message LIKE '%ímpar%' FROM scheduled_draws WHERE id='50000000-0000-0000-0000-000000000001'),'Odd draw was accepted');
SELECT pg_temp.check_true((SELECT count(*)=0 FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002'),'Odd draw wrote partial matches');
UPDATE tournament_security.lifecycle SET dirty=false,projection='{"conflicts":[],"eligible":{"Final":["40000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002"]},"expected":{"Final":2}}' WHERE tournament_id='30000000-0000-0000-0000-000000000001';
INSERT INTO scheduled_draws(id,tournament_id,fase,mode,scheduled_at) VALUES('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Final','geral',now()-interval '1 minute');
SELECT execute_scheduled_draws();
SELECT pg_temp.check_true((SELECT status='failed' FROM scheduled_draws WHERE id='50000000-0000-0000-0000-000000000002'),'Existing draw replaced');
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(published) FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000001'),'Existing match changed');
-- Successful exact pool, then repeated execution is a no-op.
UPDATE tournament_security.lifecycle SET dirty=false,projection='{"conflicts":[],"eligible":{"Final":["40000000-0000-0000-0000-000000000003","40000000-0000-0000-0000-000000000004"]},"expected":{"Final":2}}' WHERE tournament_id='30000000-0000-0000-0000-000000000002';
INSERT INTO scheduled_draws(id,tournament_id,fase,mode,scheduled_at) VALUES('50000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000002','Final','geral',now()-interval '1 minute');
SELECT execute_scheduled_draws();
SELECT execute_scheduled_draws();
SELECT pg_temp.check_true((SELECT status='done' FROM scheduled_draws WHERE id='50000000-0000-0000-0000-000000000003'),'Valid draw failed');
SELECT pg_temp.check_true((SELECT count(*)=1 AND min(mesa_numero)=1 FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002'),'Repeated draw duplicated matches');
-- Completed scheduled draws are immediately visible to anonymous visitors.
SET LOCAL ROLE anon;
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(published) FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002'),'Scheduled draw not public');
RESET ROLE;
-- Preserve the rollback test below by explicitly reverting this fixture to draft.
UPDATE matchups SET published=false WHERE tournament_id='30000000-0000-0000-0000-000000000002';
-- Stale projections cannot overwrite newer result changes.
SELECT pg_temp.check_true(NOT tournament_security.apply_projection('30000000-0000-0000-0000-000000000002',-1,'{}'),'Stale projection accepted');
CREATE TEMP TABLE saved_draw AS SELECT id FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002';
UPDATE tournament_security.lifecycle SET dirty=false WHERE tournament_id='30000000-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM save_matchup_draw('30000000-0000-0000-0000-000000000002','Final','[{"player1_id":"40000000-0000-0000-0000-000000000003","player2_id":"40000000-0000-0000-0000-000000000004","grupo":null}]',true);
  RAISE EXCEPTION 'Invalid replacement accepted';
 EXCEPTION WHEN not_null_violation THEN NULL; END;
 BEGIN
  PERFORM update_match_results('30000000-0000-0000-0000-000000000001',jsonb_build_array(
    (SELECT jsonb_build_object('id',id,'fase','Final','grupo','Final','rodada',1,'pontos_jogo',99,'pontos_mesa',100,'penalidades','Sem penalidades') FROM match_results WHERE tournament_id='30000000-0000-0000-0000-000000000001'),
    jsonb_build_object('id',gen_random_uuid(),'fase','Final','grupo','Final','rodada',1,'pontos_jogo',0,'pontos_mesa',0,'penalidades','Sem penalidades')));
  RAISE EXCEPTION 'Partial edit accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM='Partial edit accepted' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT pg_temp.check_true((SELECT count(*)=1 FROM matchups m JOIN saved_draw s ON s.id=m.id),'Replacement lost old draw');
SELECT pg_temp.check_true((SELECT pontos_jogo=3 FROM match_results WHERE tournament_id='30000000-0000-0000-0000-000000000001'),'Partial edit persisted');
-- Immediate draws publish only once successfully saved.
DELETE FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002';
UPDATE tournament_security.lifecycle SET dirty=false WHERE tournament_id='30000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT save_matchup_draw('30000000-0000-0000-0000-000000000002','Final','[{"player1_id":"40000000-0000-0000-0000-000000000003","player2_id":"40000000-0000-0000-0000-000000000004","grupo":"Final"}]',false);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.check_true((SELECT count(*)=1 AND bool_and(published) FROM matchups WHERE tournament_id='30000000-0000-0000-0000-000000000002'),'Immediate draw not public');
RESET ROLE;
ROLLBACK;
