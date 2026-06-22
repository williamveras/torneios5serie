
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'individual'
  CHECK (modalidade IN ('individual','duplas'));

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_team boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  member_nome text NOT NULL,
  member_nick text,
  member_email text,
  member_whatsapp text,
  position smallint NOT NULL CHECK (position IN (1,2)),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (team_id, position)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT SELECT ON public.team_members TO anon;
GRANT ALL ON public.team_members TO service_role;

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view team members"
  ON public.team_members FOR SELECT TO anon USING (true);
CREATE POLICY "Authenticated can view team members"
  ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert team members"
  ON public.team_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update team members"
  ON public.team_members FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete team members"
  ON public.team_members FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
