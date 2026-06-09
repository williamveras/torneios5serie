
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS campeao_id uuid REFERENCES public.players(id) ON DELETE SET NULL;

ALTER TABLE public.matchups
  ADD COLUMN IF NOT EXISTS bracket_slot integer;
