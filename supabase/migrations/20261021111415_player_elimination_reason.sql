ALTER TABLE public.players ADD COLUMN IF NOT EXISTS elimination_reason text CHECK (elimination_reason IN ('wo', 'withdrawal'));
NOTIFY pgrst, 'reload schema';
