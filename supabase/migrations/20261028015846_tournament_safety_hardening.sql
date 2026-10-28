-- Security boundaries and server-owned tournament state. Apply transactionally.
CREATE SCHEMA IF NOT EXISTS tournament_security;
REVOKE ALL ON SCHEMA tournament_security FROM PUBLIC,anon,authenticated;

DROP POLICY "Authenticated can delete team members" ON public.team_members;
DROP POLICY "Authenticated can insert team members" ON public.team_members;
DROP POLICY "Authenticated can update team members" ON public.team_members;
DROP POLICY "Authenticated can view team members" ON public.team_members;
CREATE POLICY team_organization_access ON public.team_members FOR ALL TO authenticated
 USING (EXISTS(SELECT 1 FROM public.players p WHERE p.id=team_id AND public.can_access_tournament(p.tournament_id)))
 WITH CHECK (EXISTS(SELECT 1 FROM public.players p WHERE p.id=team_id AND public.can_access_tournament(p.tournament_id)));
ALTER POLICY "Anyone can view matchups" ON public.matchups USING (published IS TRUE);

DROP FUNCTION public.get_players_public(uuid);
CREATE FUNCTION public.get_players_public(_tournament_id uuid)
RETURNS TABLE(id uuid,tournament_id uuid,nome_completo text,nick_playroom text,grupo text,is_team boolean,eliminado boolean,elimination_reason text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.tournament_id,p.nome_completo,p.nick_playroom,p.grupo,coalesce(p.is_team,false),p.eliminado,p.elimination_reason
 FROM public.players p WHERE p.tournament_id=_tournament_id;
$$;
REVOKE ALL ON FUNCTION public.get_players_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_players_public(uuid) TO anon,authenticated;

-- One result per participant/round; elimination phases permit one result per player.
CREATE UNIQUE INDEX result_group_once ON public.match_results(tournament_id,fase,rodada,player_id) WHERE fase='Fase de Grupos';
CREATE UNIQUE INDEX result_elimination_once ON public.match_results(tournament_id,fase,player_id) WHERE fase<>'Fase de Grupos';
ALTER TABLE public.match_results ADD CONSTRAINT result_positive_round CHECK(rodada>0);
CREATE FUNCTION tournament_security.validate_result() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.players p WHERE p.id=NEW.player_id AND p.tournament_id=NEW.tournament_id) THEN
  RAISE EXCEPTION 'Participante não pertence a este torneio.';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER validate_result BEFORE INSERT OR UPDATE ON public.match_results FOR EACH ROW EXECUTE FUNCTION tournament_security.validate_result();

-- Serialize membership changes and prevent self-promotion / last-owner removal.
CREATE FUNCTION tournament_security.guard_membership() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE org uuid; actor_owner boolean;
BEGIN
 org := CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
 PERFORM 1 FROM public.organizations WHERE id=org FOR UPDATE;
 actor_owner := public.has_org_role(org,auth.uid(),ARRAY['owner']::public.org_role[]);
 IF TG_OP='INSERT' AND NEW.role='owner' AND auth.uid() IS NOT NULL AND NOT actor_owner THEN
  IF NOT public.is_org_creator(org,auth.uid()) OR EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=org)
  THEN RAISE EXCEPTION 'Somente um proprietário pode conceder este papel.'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF NEW.organization_id<>OLD.organization_id OR NEW.user_id<>OLD.user_id THEN RAISE EXCEPTION 'A identidade do membro não pode ser alterada.'; END IF;
  IF (OLD.role='owner' OR NEW.role='owner') AND auth.uid() IS NOT NULL AND NOT actor_owner THEN
   RAISE EXCEPTION 'Somente um proprietário pode alterar proprietários.';
  END IF;
 ELSIF TG_OP='DELETE' AND OLD.role='owner' AND auth.uid() IS NOT NULL AND NOT actor_owner THEN
  RAISE EXCEPTION 'Somente um proprietário pode remover proprietários.';
 END IF;
 IF TG_OP<>'INSERT' AND OLD.role='owner' AND (TG_OP='DELETE' OR NEW.role<>'owner')
    AND EXISTS(SELECT 1 FROM public.organizations WHERE id=org)
    AND NOT EXISTS(SELECT 1 FROM public.organization_members WHERE organization_id=org AND role='owner' AND id<>OLD.id)
 THEN RAISE EXCEPTION 'A organização precisa manter pelo menos um proprietário.'; END IF;
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER guard_membership BEFORE INSERT OR UPDATE OR DELETE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION tournament_security.guard_membership();

ALTER TABLE public.matchups ADD COLUMN mesa_numero integer;
-- The release's captured public numbering overrides this fallback before commit.
ALTER TABLE public.matchups DISABLE TRIGGER sync_matchup_eliminations;
DO $$ BEGIN
 IF to_regclass('pg_temp.legacy_mesa_numbers') IS NOT NULL THEN
  EXECUTE 'UPDATE public.matchups m SET mesa_numero=n.n FROM pg_temp.legacy_mesa_numbers n WHERE n.id=m.id';
 ELSE
  WITH numbered AS (SELECT id,row_number() OVER(PARTITION BY tournament_id,fase ORDER BY created_at,ctid)::int n FROM public.matchups WHERE fase<>'Fase de Grupos')
  UPDATE public.matchups m SET mesa_numero=n.n FROM numbered n WHERE n.id=m.id;
 END IF;
END $$;
ALTER TABLE public.matchups ENABLE TRIGGER sync_matchup_eliminations;
CREATE UNIQUE INDEX stable_mesa_number ON public.matchups(tournament_id,fase,mesa_numero) WHERE mesa_numero IS NOT NULL;
ALTER TABLE public.matchups ADD CONSTRAINT mesa_positive CHECK(mesa_numero IS NULL OR mesa_numero>0);
CREATE FUNCTION tournament_security.assign_mesa() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.tournament_id::text,8271));
 IF NEW.player1_id=NEW.player2_id OR (SELECT count(*) FROM public.players WHERE id IN(NEW.player1_id,NEW.player2_id) AND tournament_id=NEW.tournament_id)<>2
 THEN RAISE EXCEPTION 'Confronto inválido: confira os participantes e o torneio.'; END IF;
 IF TG_OP='UPDATE' AND (NEW.tournament_id,NEW.fase,NEW.mesa_numero) IS DISTINCT FROM (OLD.tournament_id,OLD.fase,OLD.mesa_numero) THEN
  RAISE EXCEPTION 'A fase e o número de uma mesa salva não podem ser alterados.';
 END IF;
 IF NEW.fase<>'Fase de Grupos' AND NEW.mesa_numero IS NULL THEN
  SELECT coalesce(max(mesa_numero),0)+1 INTO NEW.mesa_numero FROM public.matchups WHERE tournament_id=NEW.tournament_id AND fase=NEW.fase;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER assign_mesa BEFORE INSERT OR UPDATE ON public.matchups FOR EACH ROW EXECUTE FUNCTION tournament_security.assign_mesa();

CREATE TABLE tournament_security.lifecycle (
 tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
 revision bigint NOT NULL DEFAULT 1, dirty boolean NOT NULL DEFAULT true,
 projection jsonb NOT NULL DEFAULT '{}', legacy_signature text, legacy_group_pool uuid[], legacy_playoff_pool uuid[], updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON tournament_security.lifecycle FROM PUBLIC,anon,authenticated;
INSERT INTO tournament_security.lifecycle(tournament_id) SELECT id FROM public.tournaments;
ALTER TABLE public.players ADD COLUMN qualification_eliminated boolean NOT NULL DEFAULT false;

CREATE FUNCTION tournament_security.mark_dirty() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE tid uuid;
BEGIN
 IF current_setting('torneios.projecting',true)='on' THEN RETURN COALESCE(NEW,OLD); END IF;
 IF TG_TABLE_NAME='tournaments' THEN tid:=COALESCE(NEW.id,OLD.id); ELSE tid:=COALESCE(NEW.tournament_id,OLD.tournament_id); END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,8271));
 INSERT INTO tournament_security.lifecycle(tournament_id) SELECT tid WHERE EXISTS(SELECT 1 FROM public.tournaments WHERE id=tid)
 ON CONFLICT(tournament_id) DO UPDATE SET revision=tournament_security.lifecycle.revision+1,dirty=true;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER lifecycle_dirty AFTER INSERT OR UPDATE OR DELETE ON public.match_results FOR EACH ROW EXECUTE FUNCTION tournament_security.mark_dirty();
CREATE TRIGGER lifecycle_dirty AFTER INSERT OR UPDATE OR DELETE ON public.matchups FOR EACH ROW EXECUTE FUNCTION tournament_security.mark_dirty();
CREATE TRIGGER lifecycle_dirty AFTER INSERT OR UPDATE OR DELETE ON public.players FOR EACH ROW EXECUTE FUNCTION tournament_security.mark_dirty();
CREATE TRIGGER lifecycle_dirty AFTER INSERT OR UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION tournament_security.mark_dirty();
CREATE TRIGGER lifecycle_dirty AFTER INSERT OR UPDATE OR DELETE ON public.phase_status FOR EACH ROW EXECUTE FUNCTION tournament_security.mark_dirty();

-- Preserve accepted historical group decisions while their source data is unchanged.
CREATE FUNCTION tournament_security.group_signature(tid uuid) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object(
 'results',(SELECT jsonb_agg(r ORDER BY r.id) FROM public.match_results r WHERE tournament_id=tid AND fase='Fase de Grupos'),
 'players',(SELECT jsonb_agg(jsonb_build_array(id,grupo,elimination_reason) ORDER BY id) FROM public.players WHERE tournament_id=tid),
 'settings',(SELECT to_jsonb(t)-'campeao_id'-'updated_at'-'nome'-'regulamento' FROM public.tournaments t WHERE id=tid))::text);
$$;
UPDATE tournament_security.lifecycle l SET legacy_signature=tournament_security.group_signature(l.tournament_id),
 legacy_group_pool=(SELECT array_agg(DISTINCT x) FROM public.matchups m CROSS JOIN LATERAL unnest(ARRAY[m.player1_id,m.player2_id]) x
 WHERE m.tournament_id=l.tournament_id AND m.fase IN ('Repescagem',
 (SELECT fase FROM public.matchups WHERE tournament_id=l.tournament_id AND fase NOT IN('Fase de Grupos','Repescagem','Disputa de 3º Lugar') ORDER BY created_at LIMIT 1))),
 legacy_playoff_pool=coalesce((SELECT array_agg(DISTINCT x) FROM public.matchups m CROSS JOIN LATERAL unnest(ARRAY[m.player1_id,m.player2_id]) x WHERE m.tournament_id=l.tournament_id AND m.fase='Repescagem'),'{}'::uuid[])
 WHERE EXISTS(SELECT 1 FROM public.phase_status WHERE tournament_id=l.tournament_id AND fase='Fase de Grupos' AND status='concluida')
 AND EXISTS(SELECT 1 FROM public.matchups WHERE tournament_id=l.tournament_id AND fase<>'Fase de Grupos');

CREATE FUNCTION tournament_security.snapshot(tid uuid) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('revision',l.revision,'tournament',to_jsonb(t),
  'legacyGroupPool',CASE WHEN l.legacy_signature=tournament_security.group_signature(tid) THEN to_jsonb(l.legacy_group_pool) ELSE NULL END,
  'legacyPlayoffPool',CASE WHEN l.legacy_signature=tournament_security.group_signature(tid) THEN to_jsonb(l.legacy_playoff_pool) ELSE NULL END,
  'players',coalesce((SELECT jsonb_agg(p ORDER BY p.created_at,p.id) FROM public.players p WHERE p.tournament_id=tid),'[]'),
  'results',coalesce((SELECT jsonb_agg(r ORDER BY r.created_at,r.id) FROM public.match_results r WHERE r.tournament_id=tid),'[]'),
  'matchups',coalesce((SELECT jsonb_agg(m ORDER BY m.created_at,m.mesa_numero,m.id) FROM public.matchups m WHERE m.tournament_id=tid),'[]'),
  'statuses',coalesce((SELECT jsonb_agg(s) FROM public.phase_status s WHERE s.tournament_id=tid),'[]'))
 FROM public.tournaments t JOIN tournament_security.lifecycle l ON l.tournament_id=t.id WHERE t.id=tid;
$$;
CREATE FUNCTION tournament_security.apply_projection(tid uuid,rev bigint,projection jsonb) RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE phase record;
BEGIN
 PERFORM set_config('lock_timeout','500ms',true);
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,8271));
 IF NOT EXISTS(SELECT 1 FROM tournament_security.lifecycle WHERE tournament_id=tid AND revision=rev AND dirty) THEN RETURN false; END IF;
 PERFORM set_config('torneios.projecting','on',true);
 PERFORM public.sync_result_eliminations(tid);
 UPDATE public.players p SET qualification_eliminated=(projection->'groupEliminated' ? p.id::text),
  eliminado=p.result_eliminated OR p.elimination_reason IS NOT NULL OR (projection->'groupEliminated' ? p.id::text)
   OR EXISTS(SELECT 1 FROM public.match_results r WHERE r.tournament_id=tid AND r.player_id=p.id AND r.penalidades ~* 'desistente|eliminado por w[.]o')
 WHERE p.tournament_id=tid;
 FOR phase IN SELECT * FROM jsonb_each_text(projection->'phases') LOOP
  INSERT INTO public.phase_status(tournament_id,fase,status) VALUES(tid,phase.key,CASE WHEN phase.value='true' THEN 'concluida' ELSE 'em_andamento' END)
  ON CONFLICT(tournament_id,fase) DO UPDATE SET status=EXCLUDED.status WHERE phase_status.status IS DISTINCT FROM EXCLUDED.status;
 END LOOP;
 UPDATE public.tournaments SET campeao_id=(projection->>'champion')::uuid WHERE id=tid AND campeao_id IS DISTINCT FROM (projection->>'champion')::uuid;
 UPDATE tournament_security.lifecycle SET projection=apply_projection.projection,dirty=false,updated_at=now() WHERE tournament_id=tid;
 PERFORM set_config('torneios.projecting','off',true);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.protect_advanced_player() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF current_setting('torneios.projecting',true)='on' OR current_setting('torneios.result_sync',true)='on' THEN RETURN NEW; END IF;
 IF auth.uid() IS NOT NULL THEN
  NEW.result_eliminated:=OLD.result_eliminated;
  NEW.qualification_eliminated:=OLD.qualification_eliminated;
  NEW.eliminado:=NEW.elimination_reason IS NOT NULL OR OLD.result_eliminated OR OLD.qualification_eliminated
   OR EXISTS(SELECT 1 FROM public.match_results WHERE player_id=NEW.id AND penalidades ~* 'desistente|eliminado por w[.]o');
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.get_tournament_health(tid uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 RETURN (SELECT jsonb_build_object('pending',dirty,'conflicts',coalesce(projection->'conflicts','[]'),'updated_at',updated_at) FROM tournament_security.lifecycle WHERE tournament_id=tid);
END $$;
REVOKE ALL ON FUNCTION public.get_tournament_health(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_tournament_health(uuid) TO authenticated;

CREATE FUNCTION tournament_security.draw_pool(tid uuid,phase text) RETURNS uuid[] LANGUAGE plpgsql SET search_path='' AS $$
DECLARE state tournament_security.lifecycle; pool uuid[]; expected integer;
BEGIN
 SELECT * INTO state FROM tournament_security.lifecycle WHERE tournament_id=tid;
 IF state.dirty OR NOT FOUND THEN RAISE EXCEPTION 'A classificação está sendo atualizada. Tente novamente em alguns segundos.'; END IF;
 IF jsonb_array_length(coalesce(state.projection->'conflicts','[]'))>0 THEN RAISE EXCEPTION 'Há conflito entre resultados e confrontos posteriores. Revise o aviso do torneio.'; END IF;
 IF phase='Fase de Grupos' THEN
  SELECT array_agg(id ORDER BY id) INTO pool FROM public.players WHERE tournament_id=tid AND NOT eliminado;
 ELSE
  IF NOT (state.projection->'eligible' ? phase) THEN RAISE EXCEPTION 'Conclua os resultados da fase anterior antes de sortear esta fase.'; END IF;
  SELECT array_agg(value::uuid ORDER BY value) INTO pool FROM jsonb_array_elements_text(state.projection->'eligible'->phase);
  expected:=(state.projection->'expected'->>phase)::integer;
  IF cardinality(pool) IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Classificação incompleta: esperados %, disponíveis %. Revise os participantes antes de sortear.',expected,coalesce(cardinality(pool),0); END IF;
 END IF;
 IF coalesce(cardinality(pool),0)<2 THEN RAISE EXCEPTION 'Não há participantes suficientes para o sorteio.'; END IF;
 RETURN pool;
END $$;
CREATE FUNCTION public.get_draw_players(tid uuid,phase text) RETURNS SETOF public.players LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[];
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 ids:=tournament_security.draw_pool(tid,phase);
 RETURN QUERY SELECT * FROM public.players WHERE id=ANY(ids) AND tournament_id=tid ORDER BY id;
END $$;
REVOKE ALL ON FUNCTION public.get_draw_players(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_draw_players(uuid,text) TO authenticated;

-- Atomic replacement: an error rolls back deletion and inserts together.
CREATE FUNCTION public.save_matchup_draw(tid uuid,phase text,rows jsonb,replace_existing boolean DEFAULT false) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pool uuid[]; supplied uuid[]; item jsonb; n integer;
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,8271));
 pool:=tournament_security.draw_pool(tid,phase);
 IF jsonb_typeof(rows)<>'array' OR jsonb_array_length(rows)=0 THEN RAISE EXCEPTION 'Nenhum confronto informado.'; END IF;
 IF phase<>'Fase de Grupos' THEN
  SELECT array_agg(id ORDER BY id) INTO supplied FROM (
   SELECT (v->>'player1_id')::uuid id FROM jsonb_array_elements(rows) v UNION ALL SELECT (v->>'player2_id')::uuid FROM jsonb_array_elements(rows) v
  ) s;
  IF supplied IS DISTINCT FROM pool OR cardinality(pool)%2<>0 THEN RAISE EXCEPTION 'O sorteio deve conter todos os classificados exatamente uma vez, em pares completos.'; END IF;
 ELSE
  SELECT array_agg(DISTINCT id ORDER BY id) INTO supplied FROM (
   SELECT (v->>'player1_id')::uuid id FROM jsonb_array_elements(rows) v UNION ALL SELECT (v->>'player2_id')::uuid FROM jsonb_array_elements(rows) v
  ) s;
  IF supplied IS DISTINCT FROM pool THEN RAISE EXCEPTION 'O calendário deve contemplar todos os participantes ativos.'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM public.matchups WHERE tournament_id=tid AND fase=phase) THEN
  IF NOT replace_existing THEN RAISE EXCEPTION 'Já existem confrontos nesta fase. Atualize a página.'; END IF;
  IF EXISTS(SELECT 1 FROM public.match_results WHERE tournament_id=tid AND fase=phase)
     OR EXISTS(SELECT 1 FROM public.match_schedule WHERE tournament_id=tid AND grupo=phase)
     OR EXISTS(SELECT 1 FROM public.matchups WHERE tournament_id=tid AND fase=phase AND published)
  THEN RAISE EXCEPTION 'Não é permitido substituir confrontos publicados, agendados ou com resultados.'; END IF;
  DELETE FROM public.matchups WHERE tournament_id=tid AND fase=phase;
 END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(rows) LOOP
  IF NOT ((item->>'player1_id')::uuid=ANY(pool)) OR NOT ((item->>'player2_id')::uuid=ANY(pool)) THEN RAISE EXCEPTION 'Participante inelegível no sorteio.'; END IF;
  INSERT INTO public.matchups(tournament_id,fase,grupo,player1_id,player2_id,rodada,bracket_slot)
   VALUES(tid,phase,item->>'grupo',(item->>'player1_id')::uuid,(item->>'player2_id')::uuid,(item->>'rodada')::int,(item->>'bracket_slot')::int);
 END LOOP;
 n:=jsonb_array_length(rows);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.save_matchup_draw(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_matchup_draw(uuid,text,jsonb,boolean) TO authenticated;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA tournament_security FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.sync_result_eliminations(tid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM set_config('torneios.result_sync','on',true);
  PERFORM pg_advisory_xact_lock(hashtextextended(tid::text, 8271));
  WITH decisions AS (
    SELECT CASE
      WHEN a.pontos_jogo>b.pontos_jogo THEN m.player2_id
      WHEN b.pontos_jogo>a.pontos_jogo THEN m.player1_id
      WHEN a.pontos_mesa<>b.pontos_mesa THEN
        CASE WHEN (a.pontos_mesa<b.pontos_mesa)=COALESCE(t.lower_score_wins,false) THEN m.player2_id ELSE m.player1_id END
      ELSE NULL END AS loser
    FROM public.matchups m JOIN public.tournaments t ON t.id=m.tournament_id
    JOIN LATERAL (SELECT r.* FROM public.match_results r WHERE r.tournament_id=tid AND r.fase=m.fase AND r.player_id=m.player1_id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) a ON true
    JOIN LATERAL (SELECT r.* FROM public.match_results r WHERE r.tournament_id=tid AND r.fase=m.fase AND r.player_id=m.player2_id ORDER BY r.created_at DESC,r.id DESC LIMIT 1) b ON true
    WHERE m.tournament_id=tid AND m.fase<>'Fase de Grupos'
  ), desired AS (
    SELECT p.id, EXISTS(SELECT 1 FROM decisions d WHERE d.loser=p.id) AS lost,
      (p.elimination_reason IS NOT NULL OR EXISTS(SELECT 1 FROM public.match_results r WHERE r.tournament_id=tid AND r.player_id=p.id AND r.penalidades ~* 'desistente|eliminado por w[.]o')) AS excluded
    FROM public.players p WHERE p.tournament_id=tid
  )
  UPDATE public.players p SET result_eliminated=d.lost,
    eliminado=CASE WHEN d.lost OR d.excluded OR p.qualification_eliminated THEN true WHEN p.result_eliminated THEN false ELSE p.eliminado END
  FROM desired d WHERE p.id=d.id AND (p.result_eliminated IS DISTINCT FROM d.lost OR
    p.eliminado IS DISTINCT FROM CASE WHEN d.lost OR d.excluded OR p.qualification_eliminated THEN true WHEN p.result_eliminated THEN false ELSE p.eliminado END);
  PERFORM set_config('torneios.result_sync','off',true);
END;
$$;
REVOKE ALL ON FUNCTION public.sync_result_eliminations(uuid) FROM PUBLIC,anon,authenticated;


CREATE OR REPLACE FUNCTION public.execute_scheduled_draws()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  draw RECORD;
  arr uuid[];
  n int;
  i int;
  r int;
  rounds_n int;
  a uuid;
  b uuid;
  tmp uuid;
  grupo_rec RECORD;
  num_groups int;
  per_g int;
  existing_pairs text[];
  pair_key text;
  attempt int;
  max_attempts int;
  ok boolean;
  is_group_phase boolean;
  approved_pool uuid[];
BEGIN
  FOR draw IN
    SELECT * FROM public.scheduled_draws
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM pg_advisory_xact_lock(hashtextextended(draw.tournament_id::text,8271));
      IF EXISTS(SELECT 1 FROM tournament_security.lifecycle WHERE tournament_id=draw.tournament_id AND dirty) THEN CONTINUE; END IF;
      approved_pool:=tournament_security.draw_pool(draw.tournament_id,draw.fase);
      IF draw.player_pool IS NOT NULL AND cardinality(draw.player_pool)>0 AND
         (SELECT array_agg(x ORDER BY x) FROM unnest(draw.player_pool) x) IS DISTINCT FROM approved_pool THEN
        RAISE EXCEPTION 'A lista de participantes mudou. Revise e reagende o sorteio.';
      END IF;
      IF EXISTS(SELECT 1 FROM public.matchups WHERE tournament_id=draw.tournament_id AND fase=draw.fase
        AND (draw.rodada IS NULL OR rodada=draw.rodada OR draw.fase<>'Fase de Grupos')) THEN
        RAISE EXCEPTION 'Já existem confrontos nesta fase/rodada. O sorteio não foi substituído.';
      END IF;
      IF draw.kind = 'grupos' THEN
        IF EXISTS(SELECT 1 FROM public.match_results WHERE tournament_id=draw.tournament_id)
          OR EXISTS(SELECT 1 FROM public.matchups WHERE tournament_id=draw.tournament_id) THEN
          RAISE EXCEPTION 'Não é permitido redistribuir grupos depois de criar confrontos ou resultados.';
        END IF;
        per_g := COALESCE(draw.per_group, 4);
        IF per_g < 2 THEN per_g := 2; END IF;
        SELECT array_agg(id ORDER BY random()) INTO arr
          FROM public.players
          WHERE tournament_id = draw.tournament_id AND eliminado = false;
        n := COALESCE(array_length(arr, 1), 0);
        IF n = 0 THEN
          UPDATE public.scheduled_draws
            SET status = 'failed', executed_at = now(), error_message = 'no_players'
            WHERE id = draw.id;
          CONTINUE;
        END IF;
        num_groups := GREATEST(1, CEIL(n::numeric / per_g)::int);
        FOR i IN 1..n LOOP
          UPDATE public.players
            SET grupo = (((i - 1) % num_groups) + 1)::text
            WHERE id = arr[i];
        END LOOP;
        UPDATE public.scheduled_draws
          SET status = 'done', executed_at = now(), error_message = NULL
          WHERE id = draw.id;
        CONTINUE;
      END IF;

      is_group_phase := (draw.fase = 'Fase de Grupos');

      IF draw.rodada IS NOT NULL THEN

        IF is_group_phase THEN
          SELECT COALESCE(array_agg(
            CASE WHEN player1_id::text < player2_id::text
                 THEN player1_id::text || '|' || player2_id::text
                 ELSE player2_id::text || '|' || player1_id::text END
          ), ARRAY[]::text[])
            INTO existing_pairs
            FROM public.matchups
            WHERE tournament_id = draw.tournament_id AND fase = draw.fase;
        ELSE
          existing_pairs := ARRAY[]::text[];
        END IF;
      ELSE

        existing_pairs := ARRAY[]::text[];
      END IF;

      IF draw.mode = 'geral' THEN
        max_attempts := CASE WHEN is_group_phase AND draw.rodada IS NOT NULL THEN 200 ELSE 1 END;
        attempt := 0;
        ok := false;
        WHILE attempt < max_attempts AND NOT ok LOOP
          attempt := attempt + 1;
          SELECT array_agg(id ORDER BY random()) INTO arr FROM unnest(approved_pool) AS id;
          n := COALESCE(array_length(arr, 1), 0);
          IF n%2<>0 THEN RAISE EXCEPTION 'Número ímpar de participantes. Nenhum jogador será deixado de fora.'; END IF;
          ok := true;
          i := 1;
          WHILE i + 1 <= n LOOP
            pair_key := CASE WHEN arr[i]::text < arr[i+1]::text
                             THEN arr[i]::text || '|' || arr[i+1]::text
                             ELSE arr[i+1]::text || '|' || arr[i]::text END;
            IF pair_key = ANY(existing_pairs) THEN
              ok := false;
              EXIT;
            END IF;
            i := i + 2;
          END LOOP;
        END LOOP;
        IF NOT ok THEN RAISE EXCEPTION 'Não foi possível gerar pares sem repetição. Tente novamente.'; END IF;
        i := 1;
        WHILE i + 1 <= n LOOP
          INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
            VALUES (draw.tournament_id, draw.fase, draw.fase, arr[i], arr[i+1], draw.rodada);
          i := i + 2;
        END LOOP;

      ELSIF draw.mode = 'por_grupo' THEN
        IF NOT is_group_phase THEN RAISE EXCEPTION 'Sorteio por grupo somente na fase de grupos.'; END IF;
        IF EXISTS(SELECT grupo FROM public.players WHERE id=ANY(approved_pool) GROUP BY grupo HAVING count(*)<2) THEN
          RAISE EXCEPTION 'Há grupo com menos de dois participantes. Revise os grupos antes de sortear.';
        END IF;
        IF EXISTS(SELECT 1 FROM public.players WHERE id=ANY(approved_pool) AND (grupo IS NULL OR btrim(grupo)='')) THEN
          RAISE EXCEPTION 'Defina o grupo de todos os participantes antes do sorteio.';
        END IF;
        FOR grupo_rec IN
          SELECT DISTINCT grupo FROM public.players
            WHERE tournament_id = draw.tournament_id
              AND grupo IS NOT NULL AND eliminado = false
            ORDER BY grupo
        LOOP
          IF draw.rodada IS NOT NULL THEN
            max_attempts := 200;
            attempt := 0;
            ok := false;
            WHILE attempt < max_attempts AND NOT ok LOOP
              attempt := attempt + 1;
              SELECT array_agg(id ORDER BY random()) INTO arr
                FROM public.players
                WHERE tournament_id = draw.tournament_id
                  AND grupo = grupo_rec.grupo
                  AND eliminado = false;
              n := COALESCE(array_length(arr, 1), 0);
              IF n < 2 THEN
                ok := true;
                EXIT;
              END IF;
              ok := true;
              i := 1;
              WHILE i + 1 <= n LOOP
                pair_key := CASE WHEN arr[i]::text < arr[i+1]::text
                                 THEN arr[i]::text || '|' || arr[i+1]::text
                                 ELSE arr[i+1]::text || '|' || arr[i]::text END;
                IF pair_key = ANY(existing_pairs) THEN
                  ok := false;
                  EXIT;
                END IF;
                i := i + 2;
              END LOOP;
            END LOOP;
            IF NOT ok THEN RAISE EXCEPTION 'Não foi possível gerar pares sem repetição.'; END IF;
            n := COALESCE(array_length(arr, 1), 0);
            IF n%2<>0 THEN RAISE EXCEPTION 'Grupo com número ímpar: gere o calendário completo para distribuir as folgas.'; END IF;
            IF n >= 2 THEN
              i := 1;
              WHILE i + 1 <= n LOOP
                INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
                  VALUES (draw.tournament_id, draw.fase, grupo_rec.grupo, arr[i], arr[i+1], draw.rodada);
                i := i + 2;
              END LOOP;
            END IF;
          ELSE
            SELECT array_agg(id ORDER BY random()) INTO arr
              FROM public.players
              WHERE tournament_id = draw.tournament_id
                AND grupo = grupo_rec.grupo
                AND eliminado = false;
            n := COALESCE(array_length(arr, 1), 0);
            IF n < 2 THEN CONTINUE; END IF;
            IF n % 2 = 1 THEN
              arr := arr || ARRAY[NULL::uuid];
              n := n + 1;
            END IF;
            rounds_n := n - 1;
            FOR r IN 1..rounds_n LOOP
              FOR i IN 1..(n/2) LOOP
                a := arr[i];
                b := arr[n + 1 - i];
                IF a IS NOT NULL AND b IS NOT NULL THEN
                  INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
                    VALUES (draw.tournament_id, draw.fase, grupo_rec.grupo, a, b, r);
                END IF;
              END LOOP;
              tmp := arr[n];
              FOR i IN REVERSE n..3 LOOP
                arr[i] := arr[i-1];
              END LOOP;
              arr[2] := tmp;
            END LOOP;
          END IF;
        END LOOP;
      END IF;

      UPDATE public.scheduled_draws
        SET status = 'done', executed_at = now(), error_message = NULL
        WHERE id = draw.id;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.scheduled_draws
        SET status = 'failed', executed_at = now(), error_message = SQLERRM
        WHERE id = draw.id;
    END;
  END LOOP;
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_scheduled_draws() FROM PUBLIC,anon,authenticated;

-- Editing both sides is one transaction; constraints reject conflicting entries.
CREATE FUNCTION public.update_match_results(tid uuid,entries jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE item jsonb; changed integer;
BEGIN
 IF NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,8271));
 IF jsonb_typeof(entries)<>'array' OR jsonb_array_length(entries)=0 THEN RAISE EXCEPTION 'Nenhum resultado informado.'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(entries) LOOP
  UPDATE public.match_results SET fase=item->>'fase',grupo=item->>'grupo',rodada=(item->>'rodada')::int,
   pontos_jogo=(item->>'pontos_jogo')::int,pontos_mesa=(item->>'pontos_mesa')::int,penalidades=item->>'penalidades'
   WHERE id=(item->>'id')::uuid AND tournament_id=tid;
  GET DIAGNOSTICS changed=ROW_COUNT;
  IF changed<>1 THEN RAISE EXCEPTION 'Resultado não encontrado ou sem permissão. Nenhuma alteração foi salva.'; END IF;
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.update_match_results(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.update_match_results(uuid,jsonb) TO authenticated;
CREATE UNIQUE INDEX one_pending_draw_per_phase_round ON public.scheduled_draws(tournament_id,fase,kind,(CASE WHEN fase='Fase de Grupos' THEN coalesce(rodada,0) ELSE 0 END)) WHERE status='pending';
ALTER TABLE tournament_security.lifecycle ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst,'reload schema';
