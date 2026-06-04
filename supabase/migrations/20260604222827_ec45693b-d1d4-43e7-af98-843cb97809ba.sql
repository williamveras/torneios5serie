
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Table for scheduled automatic draws
CREATE TABLE public.scheduled_draws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  fase text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('por_grupo','geral')),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed','cancelled')),
  executed_at timestamptz,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.scheduled_draws TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_draws TO authenticated;
GRANT ALL ON public.scheduled_draws TO service_role;

ALTER TABLE public.scheduled_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view scheduled draws"
  ON public.scheduled_draws FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can view scheduled draws"
  ON public.scheduled_draws FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert scheduled draws"
  ON public.scheduled_draws FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update scheduled draws"
  ON public.scheduled_draws FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete scheduled draws"
  ON public.scheduled_draws FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_scheduled_draws_updated_at
  BEFORE UPDATE ON public.scheduled_draws
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function that runs due scheduled draws
CREATE OR REPLACE FUNCTION public.execute_scheduled_draws()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
BEGIN
  FOR draw IN
    SELECT * FROM public.scheduled_draws
    WHERE status = 'pending' AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
  LOOP
    BEGIN
      -- Always replace: delete existing matchups for this fase
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
            -- rotate positions 2..n right by 1, keeping arr[1] fixed
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
$fn$;

-- Schedule cron job (every minute)
SELECT cron.schedule(
  'execute-scheduled-draws',
  '* * * * *',
  $$SELECT public.execute_scheduled_draws();$$
);
