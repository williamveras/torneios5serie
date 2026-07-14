ALTER TABLE public.matchups ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;
UPDATE public.matchups SET published = false;