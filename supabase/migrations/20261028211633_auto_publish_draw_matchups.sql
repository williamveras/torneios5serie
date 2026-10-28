-- Completed draws publish their matchups atomically. Existing drafts remain unchanged.
CREATE OR REPLACE FUNCTION public.save_matchup_draw(tid uuid,phase text,rows jsonb,replace_existing boolean DEFAULT false) RETURNS integer
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
  INSERT INTO public.matchups(tournament_id,fase,grupo,player1_id,player2_id,rodada,bracket_slot,published)
   VALUES(tid,phase,item->>'grupo',(item->>'player1_id')::uuid,(item->>'player2_id')::uuid,(item->>'rodada')::int,(item->>'bracket_slot')::int,true);
 END LOOP;
 n:=jsonb_array_length(rows);
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.save_matchup_draw(uuid,text,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_matchup_draw(uuid,text,jsonb,boolean) TO authenticated;


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
          INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada, published)
            VALUES (draw.tournament_id, draw.fase, draw.fase, arr[i], arr[i+1], draw.rodada, true);
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
                INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada, published)
                  VALUES (draw.tournament_id, draw.fase, grupo_rec.grupo, arr[i], arr[i+1], draw.rodada, true);
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
                  INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada, published)
                    VALUES (draw.tournament_id, draw.fase, grupo_rec.grupo, a, b, r, true);
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
