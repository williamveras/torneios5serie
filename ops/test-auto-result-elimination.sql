BEGIN;
DO $$
DECLARE tid uuid:=gen_random_uuid(); a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ra uuid; rb uuid;
BEGIN
INSERT INTO public.tournaments SELECT (jsonb_populate_record(NULL::public.tournaments,to_jsonb(t)||jsonb_build_object('id',tid,'nome','Teste de eliminação transacional','max_participants',10,'lower_score_wins',false))).* FROM public.tournaments t LIMIT 1;
INSERT INTO public.players(id,tournament_id,nome_completo) VALUES(a,tid,'A'),(b,tid,'B');
INSERT INTO public.matchups(tournament_id,fase,grupo,player1_id,player2_id) VALUES(tid,'Segunda Fase','Segunda Fase',a,b);
INSERT INTO public.match_results(tournament_id,player_id,fase,grupo,rodada,pontos_jogo,pontos_mesa,penalidades) VALUES(tid,a,'Segunda Fase','Segunda Fase',1,3,200,'Sem penalidades') RETURNING id INTO ra;
IF EXISTS(SELECT 1 FROM players WHERE tournament_id=tid AND eliminado) THEN RAISE EXCEPTION 'Incomplete match eliminated someone'; END IF;
INSERT INTO public.match_results(tournament_id,player_id,fase,grupo,rodada,pontos_jogo,pontos_mesa,penalidades) VALUES(tid,b,'Segunda Fase','Segunda Fase',1,0,100,'Sem penalidades') RETURNING id INTO rb;
IF NOT (SELECT eliminado AND result_eliminated FROM players WHERE id=b) OR (SELECT eliminado FROM players WHERE id=a) THEN RAISE EXCEPTION 'Loser not synchronized'; END IF;
UPDATE match_results SET pontos_jogo=6 WHERE id=rb;
IF NOT (SELECT eliminado FROM players WHERE id=a) OR (SELECT eliminado FROM players WHERE id=b) THEN RAISE EXCEPTION 'Correction failed'; END IF;
DELETE FROM match_results WHERE id=rb;
IF EXISTS(SELECT 1 FROM players WHERE tournament_id=tid AND eliminado) THEN RAISE EXCEPTION 'Delete did not restore eligibility'; END IF;
UPDATE players SET eliminado=true,elimination_reason='withdrawal' WHERE id=a;
UPDATE match_results SET pontos_jogo=0 WHERE id=ra;
IF NOT (SELECT eliminado FROM players WHERE id=a) THEN RAISE EXCEPTION 'Explicit withdrawal was cleared'; END IF;
UPDATE players SET eliminado=false,elimination_reason=null WHERE id=a;
UPDATE tournaments SET lower_score_wins=true WHERE id=tid;
INSERT INTO public.match_results(tournament_id,player_id,fase,grupo,rodada,pontos_jogo,pontos_mesa,penalidades) VALUES(tid,b,'Segunda Fase','Segunda Fase',1,0,100,'Sem penalidades');
IF NOT (SELECT eliminado FROM players WHERE id=a) OR (SELECT eliminado FROM players WHERE id=b) THEN RAISE EXCEPTION 'Lower score tie-break failed'; END IF;
END $$;
ROLLBACK;
