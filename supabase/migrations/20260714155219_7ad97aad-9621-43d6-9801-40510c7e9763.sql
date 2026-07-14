
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS repescagem_mode text NOT NULL DEFAULT 'ranking',
  ADD COLUMN IF NOT EXISTS repescagem_playoff_size integer;

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_repescagem_mode_chk;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_repescagem_mode_chk
  CHECK (repescagem_mode IN ('ranking','playoff'));

ALTER TABLE public.scheduled_draws
  ADD COLUMN IF NOT EXISTS player_pool uuid[];

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
BEGIN
  FOR draw IN
    SELECT * FROM public.scheduled_draws
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      IF draw.kind = 'grupos' THEN
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
        DELETE FROM public.matchups
          WHERE tournament_id = draw.tournament_id
            AND fase = draw.fase
            AND rodada = draw.rodada;
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
        DELETE FROM public.matchups
          WHERE tournament_id = draw.tournament_id AND fase = draw.fase;
        existing_pairs := ARRAY[]::text[];
      END IF;

      IF draw.mode = 'geral' THEN
        max_attempts := CASE WHEN is_group_phase AND draw.rodada IS NOT NULL THEN 200 ELSE 1 END;
        attempt := 0;
        ok := false;
        WHILE attempt < max_attempts AND NOT ok LOOP
          attempt := attempt + 1;
          IF draw.player_pool IS NOT NULL AND array_length(draw.player_pool, 1) > 0 THEN
            SELECT array_agg(id ORDER BY random()) INTO arr
              FROM unnest(draw.player_pool) AS id;
          ELSE
            SELECT array_agg(id ORDER BY random()) INTO arr
              FROM public.players
              WHERE tournament_id = draw.tournament_id AND eliminado = false;
          END IF;
          n := COALESCE(array_length(arr, 1), 0);
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
        i := 1;
        WHILE i + 1 <= n LOOP
          INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
            VALUES (draw.tournament_id, draw.fase, draw.fase, arr[i], arr[i+1], draw.rodada);
          i := i + 2;
        END LOOP;

      ELSIF draw.mode = 'por_grupo' THEN
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
            n := COALESCE(array_length(arr, 1), 0);
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
