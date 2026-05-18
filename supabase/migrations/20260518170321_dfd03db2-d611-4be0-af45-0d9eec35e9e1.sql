
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS email TEXT;

CREATE TABLE IF NOT EXISTS public.match_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL,
  player_id UUID NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, player_id)
);

ALTER TABLE public.match_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reminders sent"
  ON public.match_reminders_sent FOR SELECT
  TO authenticated
  USING (true);
