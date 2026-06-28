
-- 1) Add rodada column to scheduled_draws
ALTER TABLE public.scheduled_draws ADD COLUMN IF NOT EXISTS rodada int;

-- 2) Update execute_scheduled_draws to support per-round draws with no-repeat rule
CREATE OR REPLACE FUNCTION public.execute_scheduled_draws()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  draw RECORD;
  arr uuid[];
  pool uuid[];
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
  pair_list text[];
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

      -- kind = 'matchups'
      is_group_phase := (draw.fase = 'Fase de Grupos');

      IF draw.rodada IS NOT NULL THEN
        -- Per-round draw: only replace matchups of this fase+rodada
        DELETE FROM public.matchups
          WHERE tournament_id = draw.tournament_id
            AND fase = draw.fase
            AND rodada = draw.rodada;

        -- Collect existing pairs of the same fase (other rodadas) to avoid repeats in group phase
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
        -- Legacy: replace entire fase
        DELETE FROM public.matchups
          WHERE tournament_id = draw.tournament_id AND fase = draw.fase;
        existing_pairs := ARRAY[]::text[];
      END IF;

      IF draw.mode = 'geral' THEN
        -- Try up to N attempts to find a shuffle without repeats (group phase only)
        max_attempts := CASE WHEN is_group_phase AND draw.rodada IS NOT NULL THEN 200 ELSE 1 END;
        attempt := 0;
        ok := false;
        WHILE attempt < max_attempts AND NOT ok LOOP
          attempt := attempt + 1;
          SELECT array_agg(id ORDER BY random()) INTO arr
            FROM public.players
            WHERE tournament_id = draw.tournament_id AND eliminado = false;
          n := COALESCE(array_length(arr, 1), 0);
          ok := true;
          pair_list := ARRAY[]::text[];
          i := 1;
          WHILE i + 1 <= n LOOP
            pair_key := CASE WHEN arr[i]::text < arr[i+1]::text
                             THEN arr[i]::text || '|' || arr[i+1]::text
                             ELSE arr[i+1]::text || '|' || arr[i]::text END;
            IF pair_key = ANY(existing_pairs) THEN
              ok := false;
              EXIT;
            END IF;
            pair_list := pair_list || pair_key;
            i := i + 2;
          END LOOP;
        END LOOP;
        -- Insert (even if not ok, use last attempt — best effort)
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
            -- Single-round draw per group with no-repeat
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
            -- Round-robin: all rounds at once (no repeats by construction)
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
