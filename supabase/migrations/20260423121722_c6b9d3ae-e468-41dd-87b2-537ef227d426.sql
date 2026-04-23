
-- 1. Tabela phase_status
CREATE TABLE public.phase_status (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id uuid NOT NULL,
  fase text NOT NULL,
  status text NOT NULL DEFAULT 'em_andamento' CHECK (status IN ('em_andamento', 'concluida')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, fase)
);

ALTER TABLE public.phase_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view phase status"
  ON public.phase_status FOR SELECT
  USING (true);

CREATE POLICY "Authenticated can insert phase status"
  ON public.phase_status FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can update phase status"
  ON public.phase_status FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can delete phase status"
  ON public.phase_status FOR DELETE
  TO authenticated
  USING (true);

CREATE TRIGGER update_phase_status_updated_at
  BEFORE UPDATE ON public.phase_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. View pública de players (sem dados sensíveis)
CREATE VIEW public.players_public
WITH (security_invoker=on) AS
  SELECT id, tournament_id, nome_completo, nick_playroom, grupo, created_at
  FROM public.players;

GRANT SELECT ON public.players_public TO anon, authenticated;

-- 3. Policies SELECT públicas em tabelas necessárias
CREATE POLICY "Anyone can view tournaments"
  ON public.tournaments FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can view match results"
  ON public.match_results FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can view match schedule"
  ON public.match_schedule FOR SELECT
  TO anon
  USING (true);
