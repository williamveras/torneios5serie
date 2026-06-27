
ALTER TABLE public.scheduled_draws
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'matchups',
  ADD COLUMN IF NOT EXISTS per_group int;

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

      -- kind = 'matchups' (legacy)
      DELETE FROM public.matchups
        WHERE tournament_id = draw.tournament_id AND fase = draw.fase;

      IF draw.mode = 'geral' THEN
        SELECT array_agg(id ORDER BY random()) INTO arr
          FROM public.players
          WHERE tournament_id = draw.tournament_id AND eliminado = false;
        n := COALESCE(array_length(arr, 1), 0);
        i := 1;
        WHILE i + 1 <= n LOOP
          INSERT INTO public.matchups (tournament_id, fase, grupo, player1_id, player2_id)
            VALUES (draw.tournament_id, draw.fase, draw.fase, arr[i], arr[i+1]);
          i := i + 2;
        END LOOP;

      ELSIF draw.mode = 'por_grupo' THEN
        FOR grupo_rec IN
          SELECT DISTINCT grupo FROM public.players
            WHERE tournament_id = draw.tournament_id
              AND grupo IS NOT NULL AND eliminado = false
            ORDER BY grupo
        LOOP
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
