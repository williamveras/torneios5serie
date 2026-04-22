CREATE TABLE public.matchups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL,
  fase TEXT NOT NULL DEFAULT 'Fase de Grupos',
  grupo TEXT NOT NULL,
  player1_id UUID NOT NULL,
  player2_id UUID NOT NULL,
  rodada INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.matchups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view matchups"
  ON public.matchups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert matchups"
  ON public.matchups FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update matchups"
  ON public.matchups FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete matchups"
  ON public.matchups FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_matchups_tournament ON public.matchups(tournament_id);