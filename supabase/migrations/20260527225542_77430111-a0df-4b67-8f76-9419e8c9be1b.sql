
CREATE TABLE public.registration_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.registration_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registration_links TO authenticated;
GRANT ALL ON public.registration_links TO service_role;

ALTER TABLE public.registration_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view registration links"
ON public.registration_links FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Authenticated can insert registration links"
ON public.registration_links FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update registration links"
ON public.registration_links FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete registration links"
ON public.registration_links FOR DELETE
TO authenticated
USING (true);

-- Allow public (anon) to insert players ONLY through valid registration link flow
CREATE POLICY "Public can insert players via valid link"
ON public.players FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.registration_links rl
    WHERE rl.tournament_id = players.tournament_id
      AND rl.expires_at > now()
  )
);

GRANT INSERT ON public.players TO anon;
