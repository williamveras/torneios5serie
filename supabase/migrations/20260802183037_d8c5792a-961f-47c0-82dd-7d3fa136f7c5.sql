CREATE OR REPLACE FUNCTION public.is_org_creator(_org uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations
    WHERE id = _org
      AND created_by = _user
  );
$$;

REVOKE ALL ON FUNCTION public.is_org_creator(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_creator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_creator(uuid, uuid) TO service_role;

DROP POLICY IF EXISTS "Owners/admins add members" ON public.organization_members;

CREATE POLICY "Owners/admins add members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_org_role(
    organization_id,
    auth.uid(),
    ARRAY['owner'::public.org_role, 'admin'::public.org_role]
  )
  OR (
    user_id = auth.uid()
    AND role = 'owner'::public.org_role
    AND public.is_org_creator(organization_id, auth.uid())
  )
);