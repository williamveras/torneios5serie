CREATE TABLE public.tournament_sponsors (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 150),
 category text NOT NULL DEFAULT 'sponsor' CHECK (category IN ('sponsor','master','support')),
 website text CHECK (website IS NULL OR (length(website)<=2048 AND website ~* '^https?://[^[:space:]]+$')),
 enabled boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0 CHECK (position>=0)
);
CREATE INDEX tournament_sponsors_tournament ON public.tournament_sponsors(tournament_id,position);
ALTER TABLE public.tournament_sponsors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tournament_sponsors FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.tournament_sponsors TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON public.tournament_sponsors TO authenticated;
CREATE POLICY public_enabled_sponsors ON public.tournament_sponsors FOR SELECT TO anon,authenticated USING (enabled);
CREATE POLICY members_read_sponsors ON public.tournament_sponsors FOR SELECT TO authenticated
 USING (account_security.is_approved() AND public.can_access_tournament(tournament_id));
CREATE POLICY members_insert_sponsors ON public.tournament_sponsors FOR INSERT TO authenticated
 WITH CHECK (account_security.is_approved() AND public.can_access_tournament(tournament_id));
CREATE POLICY members_update_sponsors ON public.tournament_sponsors FOR UPDATE TO authenticated
 USING (account_security.is_approved() AND public.can_access_tournament(tournament_id))
 WITH CHECK (account_security.is_approved() AND public.can_access_tournament(tournament_id));
CREATE POLICY members_delete_sponsors ON public.tournament_sponsors FOR DELETE TO authenticated
 USING (account_security.is_approved() AND public.can_access_tournament(tournament_id));

-- Replace the old hardcoded banner with explicitly scoped, editable records.
INSERT INTO public.tournament_sponsors(tournament_id,name,category,position)
 SELECT id,'Barão','master',1 FROM public.tournaments WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e' AND organization_id='ff5c8e62-4ffb-402d-b998-19d2c77467d3';
INSERT INTO public.tournament_sponsors(tournament_id,name,category,position)
 SELECT id,'Web Rádio Mix Play','support',2 FROM public.tournaments WHERE id='b21eec68-3681-4a37-9740-6dbb8703f61e' AND organization_id='ff5c8e62-4ffb-402d-b998-19d2c77467d3';
INSERT INTO public.tournament_sponsors(tournament_id,name,category,position)
 SELECT id,'Cegos Brasil','sponsor',1 FROM public.tournaments WHERE id='b87eabe4-2776-428d-9ed2-ac573c0e6ec0' AND organization_id='be95c529-4eee-4a04-a227-eb7c4f8dedb4';
NOTIFY pgrst,'reload schema';
