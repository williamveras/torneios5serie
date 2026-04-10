
CREATE TABLE public.match_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  data_partida date NOT NULL,
  horario time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view schedules"
ON public.match_schedule FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert schedules"
ON public.match_schedule FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update schedules"
ON public.match_schedule FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete schedules"
ON public.match_schedule FOR DELETE TO authenticated USING (true);
