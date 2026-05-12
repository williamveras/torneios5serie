ALTER TABLE public.match_schedule ADD COLUMN IF NOT EXISTS observacao text;
ALTER TABLE public.match_schedule ALTER COLUMN data_partida DROP NOT NULL;
ALTER TABLE public.match_schedule ALTER COLUMN horario DROP NOT NULL;