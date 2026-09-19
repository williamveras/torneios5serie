BEGIN;
CREATE SCHEMA IF NOT EXISTS account_security;
REVOKE ALL ON SCHEMA account_security FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA account_security TO authenticated;
CREATE TABLE account_security.requests (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz, decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE account_security.administrators (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
CREATE TABLE account_security.mail_queue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,kind)
);
ALTER TABLE account_security.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_security.administrators ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_security.mail_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA account_security FROM PUBLIC,anon,authenticated;
INSERT INTO account_security.requests(user_id,status,decided_at) SELECT id,'approved',now() FROM auth.users;
INSERT INTO account_security.administrators SELECT id FROM auth.users WHERE lower(email)='williamveras2010@gmail.com' AND email_confirmed_at IS NOT NULL;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM account_security.administrators) THEN RAISE EXCEPTION 'Confirmed approval administrator is missing'; END IF;
END $$;
CREATE FUNCTION account_security.is_approved() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM account_security.requests WHERE user_id=auth.uid() AND status='approved');
$$;
CREATE FUNCTION account_security.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT account_security.is_approved() AND EXISTS(SELECT 1 FROM account_security.administrators WHERE user_id=auth.uid());
$$;
CREATE FUNCTION account_security.new_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO account_security.requests(user_id) VALUES(NEW.id);
 INSERT INTO account_security.mail_queue(user_id,kind) VALUES(NEW.id,'pending');
 INSERT INTO public.profiles(user_id,nome) VALUES(NEW.id,coalesce(nullif(trim(NEW.raw_user_meta_data->>'nome'),''),split_part(NEW.email,'@',1))) ON CONFLICT DO NOTHING;
 RETURN NEW;
END;
$$;
CREATE TRIGGER account_approval_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION account_security.new_account();
CREATE FUNCTION account_security.access_status() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('status',coalesce((SELECT status FROM account_security.requests WHERE user_id=auth.uid()),'pending'),'is_admin',account_security.is_admin());
END;
$$;
CREATE FUNCTION account_security.list_requests() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_admin() THEN RAISE EXCEPTION 'Acesso restrito ao administrador de contas' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(row_to_json(x)) FROM (
 SELECT r.user_id,r.status,r.created_at,r.decided_at,u.email,left(coalesce(u.raw_user_meta_data->>'nome',''),200) AS nome
 FROM account_security.requests r JOIN auth.users u ON u.id=r.user_id ORDER BY (r.status='pending') DESC,r.created_at DESC
 ) x),'[]'::jsonb);
END;
$$;
CREATE FUNCTION account_security.decide(target uuid, decision text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_admin() THEN RAISE EXCEPTION 'Acesso restrito ao administrador de contas' USING ERRCODE='42501'; END IF;
 IF decision NOT IN ('approved','rejected') OR decision IS NULL THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
 UPDATE account_security.requests SET status=decision,decided_at=now(),decided_by=auth.uid() WHERE user_id=target AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação inexistente ou já analisada'; END IF;
 INSERT INTO account_security.mail_queue(user_id,kind) VALUES(target,decision);
END;
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA account_security FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION account_security.is_approved(),account_security.is_admin(),account_security.access_status(),account_security.list_requests(),account_security.decide(uuid,text) TO authenticated;
CREATE FUNCTION public.account_access_status() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.access_status(); $$;
CREATE FUNCTION public.account_approval_requests() RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.list_requests(); $$;
CREATE FUNCTION public.decide_account_approval(target uuid, decision text) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT account_security.decide(target,decision); $$;
REVOKE ALL ON FUNCTION public.account_access_status(),public.account_approval_requests(),public.decide_account_approval(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.account_access_status(),public.account_approval_requests(),public.decide_account_approval(uuid,text) TO authenticated;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['match_reminders_sent','match_results','match_schedule','matchups','organization_members','organizations','phase_status','players','profiles','registration_links','scheduled_draws','team_members','tournaments'] LOOP
  EXECUTE format('CREATE POLICY approved_account_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT account_security.is_approved())) WITH CHECK ((SELECT account_security.is_approved()))',tab);
 END LOOP;
END $$;
-- Background operations are not browser actions and must not bypass account approval.
REVOKE EXECUTE ON FUNCTION public.execute_scheduled_draws() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.execute_scheduled_draws() TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
