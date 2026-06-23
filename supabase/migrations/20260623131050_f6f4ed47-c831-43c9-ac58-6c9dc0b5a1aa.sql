
-- 1. Enum & tables ----------------------------------------------------
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT ALL ON public.organizations TO service_role;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organization_members TO authenticated;
GRANT ALL ON public.organization_members TO service_role;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_organizations_updated
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Add organization_id to tournaments FIRST (functions reference it)
ALTER TABLE public.tournaments ADD COLUMN organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 3. Helper functions (SECURITY DEFINER) -----------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(_org uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
                 WHERE organization_id = _org AND user_id = _user);
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org uuid, _user uuid, _roles public.org_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.organization_members
                 WHERE organization_id = _org AND user_id = _user AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.can_access_tournament(_t uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    JOIN public.organization_members om ON om.organization_id = t.organization_id
    WHERE t.id = _t AND om.user_id = auth.uid()
  );
$$;

-- 4. Policies on orgs & members --------------------------------------
CREATE POLICY "Members view their organizations" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "Any authenticated can create organization" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners/admins update organization" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "Owners delete organization" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::public.org_role[]));

CREATE POLICY "Members view their org membership rows" ON public.organization_members
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Owners/admins add members" ON public.organization_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
    OR (user_id = auth.uid() AND role = 'owner'
        AND EXISTS (SELECT 1 FROM public.organizations o
                    WHERE o.id = organization_id AND o.created_by = auth.uid()))
  );
CREATE POLICY "Owners/admins update members" ON public.organization_members
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));
CREATE POLICY "Owners/admins or self remove members" ON public.organization_members
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[])
    OR user_id = auth.uid()
  );

-- 5. Seed default org & migrate ---------------------------------------
DO $$
DECLARE
  v_default_org uuid;
  v_first_user uuid;
BEGIN
  SELECT id INTO v_first_user FROM auth.users ORDER BY created_at ASC LIMIT 1;
  INSERT INTO public.organizations (nome, slug, created_by)
  VALUES ('Torneios Quinta Série', 'torneios-quinta-serie', v_first_user)
  RETURNING id INTO v_default_org;
  UPDATE public.tournaments SET organization_id = v_default_org WHERE organization_id IS NULL;
  INSERT INTO public.organization_members (organization_id, user_id, role)
  SELECT v_default_org, u.id,
    CASE WHEN u.id = v_first_user THEN 'owner'::public.org_role
         ELSE 'admin'::public.org_role END
  FROM auth.users u
  ON CONFLICT DO NOTHING;
END $$;

ALTER TABLE public.tournaments ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX idx_tournaments_org ON public.tournaments(organization_id);

-- 6. tournaments policies --------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view all tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can update their own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can delete their own tournaments" ON public.tournaments;

CREATE POLICY "Public can view tournaments"
  ON public.tournaments FOR SELECT TO anon USING (true);
CREATE POLICY "Org members view tournaments"
  ON public.tournaments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members create tournaments"
  ON public.tournaments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org members update tournaments"
  ON public.tournaments FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "Org admins delete tournaments"
  ON public.tournaments FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','admin']::public.org_role[]));

-- 7. Child tables: gate writes/reads by org membership ---------------
-- players
DROP POLICY IF EXISTS "Authenticated users can view all players" ON public.players;
DROP POLICY IF EXISTS "Authenticated users can add players" ON public.players;
DROP POLICY IF EXISTS "Authenticated users can update players" ON public.players;
DROP POLICY IF EXISTS "Authenticated users can delete players" ON public.players;
CREATE POLICY "Org members view players" ON public.players FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write players" ON public.players FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update players" ON public.players FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete players" ON public.players FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- match_results
DROP POLICY IF EXISTS "Authenticated users can view all results" ON public.match_results;
DROP POLICY IF EXISTS "Authenticated users can add results" ON public.match_results;
DROP POLICY IF EXISTS "Authenticated users can update results" ON public.match_results;
DROP POLICY IF EXISTS "Authenticated users can delete results" ON public.match_results;
CREATE POLICY "Org members view match_results" ON public.match_results FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write match_results" ON public.match_results FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update match_results" ON public.match_results FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete match_results" ON public.match_results FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- match_schedule
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.match_schedule;
DROP POLICY IF EXISTS "Authenticated users can insert schedules" ON public.match_schedule;
DROP POLICY IF EXISTS "Authenticated users can update schedules" ON public.match_schedule;
DROP POLICY IF EXISTS "Authenticated users can delete schedules" ON public.match_schedule;
CREATE POLICY "Org members view match_schedule" ON public.match_schedule FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write match_schedule" ON public.match_schedule FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update match_schedule" ON public.match_schedule FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete match_schedule" ON public.match_schedule FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- matchups
DROP POLICY IF EXISTS "Authenticated users can view matchups" ON public.matchups;
DROP POLICY IF EXISTS "Authenticated users can insert matchups" ON public.matchups;
DROP POLICY IF EXISTS "Authenticated users can update matchups" ON public.matchups;
DROP POLICY IF EXISTS "Authenticated users can delete matchups" ON public.matchups;
CREATE POLICY "Org members view matchups" ON public.matchups FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write matchups" ON public.matchups FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update matchups" ON public.matchups FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete matchups" ON public.matchups FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- phase_status
DROP POLICY IF EXISTS "Authenticated can insert phase status" ON public.phase_status;
DROP POLICY IF EXISTS "Authenticated can update phase status" ON public.phase_status;
DROP POLICY IF EXISTS "Authenticated can delete phase status" ON public.phase_status;
CREATE POLICY "Org members write phase_status" ON public.phase_status FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update phase_status" ON public.phase_status FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete phase_status" ON public.phase_status FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- registration_links
DROP POLICY IF EXISTS "Authenticated can view registration links" ON public.registration_links;
DROP POLICY IF EXISTS "Authenticated can insert registration links" ON public.registration_links;
DROP POLICY IF EXISTS "Authenticated can update registration links" ON public.registration_links;
DROP POLICY IF EXISTS "Authenticated can delete registration links" ON public.registration_links;
CREATE POLICY "Org members view registration_links" ON public.registration_links FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write registration_links" ON public.registration_links FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update registration_links" ON public.registration_links FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete registration_links" ON public.registration_links FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));

-- scheduled_draws
DROP POLICY IF EXISTS "Authenticated can view scheduled draws" ON public.scheduled_draws;
DROP POLICY IF EXISTS "Authenticated can insert scheduled draws" ON public.scheduled_draws;
DROP POLICY IF EXISTS "Authenticated can update scheduled draws" ON public.scheduled_draws;
DROP POLICY IF EXISTS "Authenticated can delete scheduled draws" ON public.scheduled_draws;
CREATE POLICY "Org members view scheduled_draws" ON public.scheduled_draws FOR SELECT TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members write scheduled_draws" ON public.scheduled_draws FOR INSERT TO authenticated WITH CHECK (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members update scheduled_draws" ON public.scheduled_draws FOR UPDATE TO authenticated USING (public.can_access_tournament(tournament_id));
CREATE POLICY "Org members delete scheduled_draws" ON public.scheduled_draws FOR DELETE TO authenticated USING (public.can_access_tournament(tournament_id));
