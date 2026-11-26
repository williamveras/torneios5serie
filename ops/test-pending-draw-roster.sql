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

UPDATE players SET is_team=true WHERE id='40000000-0000-0000-0000-000000000001';
UPDATE team_members SET member_nick='Alpha' WHERE team_id='40000000-0000-0000-0000-000000000001';
INSERT INTO team_members(team_id,member_nome,member_nick,position) VALUES('40000000-0000-0000-0000-000000000001','Hidden Name','Beta',2);
UPDATE players SET nick_playroom='Gamma' WHERE id='40000000-0000-0000-0000-000000000002';
INSERT INTO players(id,tournament_id,nome_completo,nick_playroom,elimination_reason,eliminado) VALUES
('40000000-0000-0000-0000-000000000004','30000000-0000-0000-0000-000000000001','Hidden Loser','Loser','withdrawal',true);
INSERT INTO scheduled_draws(id,tournament_id,fase,mode,scheduled_at) VALUES('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','Final','geral',now()+interval '1 day');
UPDATE tournament_security.lifecycle SET dirty=false,projection='{"eligible":{"Final":["40000000-0000-0000-0000-000000000001","40000000-0000-0000-0000-000000000002"]},"expected":{"Final":2},"conflicts":[]}' WHERE tournament_id='30000000-0000-0000-0000-000000000001';
SET LOCAL ROLE anon;
SELECT pg_temp.check_true(get_pending_draw_roster('50000000-0000-0000-0000-000000000001') = '{"status":"ready","participants":[{"team":true,"nicks":["Alpha","Beta"]},{"team":false,"nicks":["Gamma"]}]}'::jsonb,'Anonymous roster must contain only eligible nicks, no names, contacts, or foreign-organization players');
SELECT pg_temp.check_true(get_pending_draw_roster('50000000-0000-0000-0000-000000000099')->>'status'='unavailable','Unknown draw exposed');
RESET ROLE;
UPDATE tournament_security.lifecycle SET dirty=true WHERE tournament_id='30000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true(get_pending_draw_roster('50000000-0000-0000-0000-000000000001')='{"status":"updating"}'::jsonb,'Stale projection exposed');
UPDATE tournament_security.lifecycle SET dirty=false WHERE tournament_id='30000000-0000-0000-0000-000000000001';
UPDATE scheduled_draws SET player_pool=ARRAY['40000000-0000-0000-0000-000000000001'::uuid] WHERE id='50000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true(get_pending_draw_roster('50000000-0000-0000-0000-000000000001')='{"status":"review"}'::jsonb,'Changed stored pool exposed');
UPDATE scheduled_draws SET player_pool=null,fase='Fase de Grupos',kind='grupos' WHERE id='50000000-0000-0000-0000-000000000001';
SELECT pg_temp.check_true(jsonb_array_length(get_pending_draw_roster('50000000-0000-0000-0000-000000000001')->'participants')=2,'Group draw includes eliminated player');
UPDATE scheduled_draws SET status='done' WHERE id='50000000-0000-0000-0000-000000000001';
SET LOCAL ROLE anon;
SELECT pg_temp.check_true(get_pending_draw_roster('50000000-0000-0000-0000-000000000001')='{"status":"unavailable"}'::jsonb,'Completed draw exposes stale roster');
RESET ROLE;
ROLLBACK;
SELECT 'Public draw roster checks passed';
