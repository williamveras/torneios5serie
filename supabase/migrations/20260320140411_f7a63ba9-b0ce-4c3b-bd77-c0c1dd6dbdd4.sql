
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.tournaments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  data_inicio DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tournaments" ON public.tournaments FOR SELECT USING (auth.uid() = created_by);
CREATE POLICY "Users can create tournaments" ON public.tournaments FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update their own tournaments" ON public.tournaments FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete their own tournaments" ON public.tournaments FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  nick_playroom TEXT,
  whatsapp TEXT,
  preferencia_horarios TEXT,
  comentario TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view players of their tournaments" ON public.players FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can add players to their tournaments" ON public.players FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can update players of their tournaments" ON public.players FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can delete players from their tournaments" ON public.players FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);

CREATE TABLE public.match_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  grupo TEXT NOT NULL,
  rodada INTEGER NOT NULL,
  pontos_jogo INTEGER NOT NULL DEFAULT 0,
  pontos_mesa INTEGER NOT NULL DEFAULT 0,
  penalidades TEXT NOT NULL DEFAULT 'Sem penalidades',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view results of their tournaments" ON public.match_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can add results to their tournaments" ON public.match_results FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can update results of their tournaments" ON public.match_results FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
CREATE POLICY "Users can delete results from their tournaments" ON public.match_results FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.tournaments WHERE id = tournament_id AND created_by = auth.uid())
);
