CREATE OR REPLACE FUNCTION account_security.list_requests() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_admin() THEN RAISE EXCEPTION 'Acesso restrito ao administrador de contas' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
 SELECT r.user_id,r.status,r.created_at,r.decided_at,u.email,left(coalesce(u.raw_user_meta_data->>'nome',''),200) AS nome,
 o.id AS organization_id,o.nome AS organization_name,
 coalesce(public.has_org_role(o.id,auth.uid(),ARRAY['owner','admin']::public.org_role[]),false) AS can_add_member
 FROM account_security.requests r JOIN auth.users u ON u.id=r.user_id
 LEFT JOIN LATERAL (
   SELECT org.id,org.nome FROM public.organizations org
   WHERE org.public_base_url=u.raw_user_meta_data->>'site_origin'
     AND org.public_base_url IN ('https://torneios.vini10.com','https://torneios.5serie.net','https://torneios.amizadevip.com.br')
   ORDER BY org.id LIMIT 1
 ) o ON true
 ORDER BY (r.status='pending') DESC,r.created_at DESC
 ) x),'[]'::jsonb);
END $$;

-- Origin metadata is only a suggestion for the administrator. Membership
-- requires an explicit organization and current permission to manage it.
CREATE FUNCTION account_security.approve_and_join(target uuid,org uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_admin() OR NOT coalesce(public.has_org_role(org,auth.uid(),ARRAY['owner','admin']::public.org_role[]),false)
 THEN RAISE EXCEPTION 'É necessário administrar as aprovações e a organização selecionada' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.organizations WHERE id=org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organização inexistente'; END IF;
 -- Recheck after the organization lock, shared with membership changes.
 IF NOT public.has_org_role(org,auth.uid(),ARRAY['owner','admin']::public.org_role[]) THEN RAISE EXCEPTION 'Sem permissão na organização' USING ERRCODE='42501'; END IF;
 PERFORM account_security.decide(target,'approved');
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(org,target,'member') ON CONFLICT(organization_id,user_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION account_security.approve_and_join(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION account_security.approve_and_join(uuid,uuid) TO authenticated;
CREATE FUNCTION public.approve_account_with_membership(target uuid,org uuid) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT account_security.approve_and_join(target,org);
$$;
REVOKE ALL ON FUNCTION public.approve_account_with_membership(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_account_with_membership(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
