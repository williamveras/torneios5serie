BEGIN;
CREATE TABLE account_security.organization_invites (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 email text NOT NULL, role public.org_role NOT NULL CHECK(role IN ('admin','member')),
 invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 accepted_at timestamptz, sent_at timestamptz, attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organization_invites_one_pending ON account_security.organization_invites(organization_id,email) WHERE status='pending';
ALTER TABLE account_security.organization_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON account_security.organization_invites FROM PUBLIC,anon,authenticated;
CREATE FUNCTION account_security.can_invite(org uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT account_security.is_approved() AND public.has_org_role(org,auth.uid(),ARRAY['owner','admin']::public.org_role[]);
$$;
CREATE FUNCTION account_security.send_invite(org uuid, recipient text, invited_role text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE addr text:=lower(trim(recipient)); result uuid;
BEGIN
 IF NOT account_security.can_invite(org) THEN RAISE EXCEPTION 'Sem permissão para convidar nesta organização' USING ERRCODE='42501'; END IF;
 IF addr IS NULL OR length(addr)>254 OR addr !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Informe um e-mail válido'; END IF;
 IF invited_role IS NULL OR invited_role NOT IN ('admin','member') THEN RAISE EXCEPTION 'Papel inválido'; END IF;
 IF EXISTS(SELECT 1 FROM public.organization_members m JOIN auth.users u ON u.id=m.user_id WHERE m.organization_id=org AND lower(u.email)=addr) THEN RAISE EXCEPTION 'Este usuário já é membro da organização'; END IF;
 UPDATE account_security.organization_invites SET status='revoked' WHERE organization_id=org AND email=addr AND status='pending' AND expires_at<=now();
 IF EXISTS(SELECT 1 FROM account_security.organization_invites WHERE organization_id=org AND email=addr AND status='pending') THEN RAISE EXCEPTION 'Já existe um convite pendente. Use Reenviar ou Cancelar.'; END IF;
 IF (SELECT count(*) FROM account_security.organization_invites WHERE organization_id=org AND created_at>now()-interval '1 hour')>=30 THEN RAISE EXCEPTION 'Limite de 30 convites por hora. Tente mais tarde.'; END IF;
 INSERT INTO account_security.organization_invites(organization_id,email,role,invited_by) VALUES(org,addr,invited_role::public.org_role,auth.uid()) RETURNING id INTO result;
 RETURN result;
END;
$$;
CREATE FUNCTION account_security.list_invites(org uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.can_invite(org) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (SELECT id,email,role,CASE WHEN status='pending' AND expires_at<=now() THEN 'expired' ELSE status END AS status,expires_at,sent_at,attempts FROM account_security.organization_invites WHERE organization_id=org ORDER BY created_at DESC LIMIT 100) x),'[]'::jsonb);
END;
$$;
CREATE FUNCTION account_security.manage_invite(invitation uuid, action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv account_security.organization_invites;
BEGIN
 SELECT * INTO inv FROM account_security.organization_invites WHERE id=invitation FOR UPDATE;
 IF inv.id IS NULL OR NOT account_security.can_invite(inv.organization_id) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF inv.status<>'pending' THEN RAISE EXCEPTION 'Convite já encerrado'; END IF;
 IF action='revoke' THEN UPDATE account_security.organization_invites SET status='revoked' WHERE id=invitation;
 ELSIF action='resend' THEN
  IF inv.next_attempt>now() OR greatest(inv.sent_at,inv.created_at)>now()-interval '1 minute' THEN RAISE EXCEPTION 'Aguarde um minuto antes de reenviar'; END IF;
  UPDATE account_security.organization_invites SET status='revoked' WHERE id=invitation;
  PERFORM account_security.send_invite(inv.organization_id,inv.email,inv.role::text);
 ELSE RAISE EXCEPTION 'Ação inválida'; END IF;
END;
$$;
CREATE FUNCTION account_security.receive_invite(invitation uuid, accept_it boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv account_security.organization_invites; addr text; org_name text;
BEGIN
 IF NOT account_security.is_approved() THEN RAISE EXCEPTION 'Sua conta precisa ser aprovada antes de aceitar o convite' USING ERRCODE='42501'; END IF;
 SELECT lower(email) INTO addr FROM auth.users WHERE id=auth.uid();
 SELECT * INTO inv FROM account_security.organization_invites WHERE id=invitation FOR UPDATE;
 IF inv.id IS NULL OR addr IS DISTINCT FROM inv.email OR inv.status='revoked' OR (inv.status='pending' AND inv.expires_at<=now()) THEN RAISE EXCEPTION 'Convite inválido, expirado ou enviado para outro e-mail'; END IF;
 IF NOT EXISTS(SELECT 1 FROM account_security.requests WHERE user_id=inv.invited_by AND status='approved') OR NOT public.has_org_role(inv.organization_id,inv.invited_by,ARRAY['owner','admin']::public.org_role[]) THEN RAISE EXCEPTION 'O responsável pelo convite não administra mais esta organização'; END IF;
 SELECT nome INTO org_name FROM public.organizations WHERE id=inv.organization_id;
 IF accept_it AND inv.status='pending' THEN
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(inv.organization_id,auth.uid(),inv.role) ON CONFLICT(organization_id,user_id) DO NOTHING;
  UPDATE account_security.organization_invites SET status='accepted',accepted_at=now() WHERE id=inv.id;
  inv.status:='accepted';
 END IF;
 RETURN jsonb_build_object('organization_id',inv.organization_id,'organization_name',org_name,'role',inv.role,'status',inv.status);
END;
$$;
REVOKE ALL ON FUNCTION account_security.can_invite(uuid),account_security.send_invite(uuid,text,text),account_security.list_invites(uuid),account_security.manage_invite(uuid,text),account_security.receive_invite(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION account_security.can_invite(uuid),account_security.send_invite(uuid,text,text),account_security.list_invites(uuid),account_security.manage_invite(uuid,text),account_security.receive_invite(uuid,boolean) TO authenticated;
CREATE FUNCTION public.send_organization_invite(org uuid,recipient text,invited_role text) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.send_invite(org,recipient,invited_role); $$;
CREATE FUNCTION public.list_organization_invites(org uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.list_invites(org); $$;
CREATE FUNCTION public.manage_organization_invite(invitation uuid,action text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.manage_invite(invitation,action); $$;
CREATE FUNCTION public.get_organization_invite(invitation uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.receive_invite(invitation,false); $$;
CREATE FUNCTION public.accept_organization_invite(invitation uuid) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.receive_invite(invitation,true); $$;
REVOKE ALL ON FUNCTION public.send_organization_invite(uuid,text,text),public.list_organization_invites(uuid),public.manage_organization_invite(uuid,text),public.get_organization_invite(uuid),public.accept_organization_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.send_organization_invite(uuid,text,text),public.list_organization_invites(uuid),public.manage_organization_invite(uuid,text),public.get_organization_invite(uuid),public.accept_organization_invite(uuid) TO authenticated;
DROP POLICY "Owners/admins add members" ON public.organization_members;
CREATE POLICY "Creator joins own organization" ON public.organization_members FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid() AND role='owner' AND public.is_org_creator(organization_id,auth.uid()));
CREATE FUNCTION account_security.preserve_membership_identity() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'Não é permitido transferir um vínculo de membro. Envie um convite.'; END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION account_security.preserve_membership_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_membership_identity BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION account_security.preserve_membership_identity();
NOTIFY pgrst,'reload schema';
COMMIT;
