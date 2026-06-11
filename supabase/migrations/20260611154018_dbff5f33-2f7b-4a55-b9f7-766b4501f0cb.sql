ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS direct_per_group integer,
  ADD COLUMN IF NOT EXISTS repescagem_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS repescagem_total integer;