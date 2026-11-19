CREATE TABLE tournament_security.translations (
 tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK(kind IN ('rules','note')), source_id uuid NOT NULL,
 language text NOT NULL CHECK(language IN ('en','es','fr')),
 source_text text NOT NULL, source_hash text NOT NULL,
 translated_text text, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','ready','failed')),
 reviewed boolean NOT NULL DEFAULT false, attempts integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(), next_attempt timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(tournament_id,kind,source_id,language)
);
ALTER TABLE tournament_security.translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tournament_security.translations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION tournament_security.queue_translation(tid uuid,field text,sid uuid,source text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF source IS NULL OR btrim(source)='' THEN
  DELETE FROM tournament_security.translations WHERE tournament_id=tid AND kind=field AND source_id=sid;
  RETURN;
 END IF;
 INSERT INTO tournament_security.translations(tournament_id,kind,source_id,language,source_text,source_hash)
 SELECT tid,field,sid,lang,source,md5(source) FROM unnest(ARRAY['en','es','fr']) lang
 ON CONFLICT(tournament_id,kind,source_id,language) DO UPDATE SET source_text=EXCLUDED.source_text,
 source_hash=EXCLUDED.source_hash,translated_text=NULL,status='pending',reviewed=false,attempts=0,next_attempt=now(),updated_at=now()
 WHERE translations.source_hash<>EXCLUDED.source_hash;
END $$;
CREATE FUNCTION tournament_security.translation_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='tournaments' THEN
  PERFORM tournament_security.queue_translation(NEW.id,'rules',NEW.id,NEW.regulamento);
 ELSIF TG_OP='DELETE' THEN
  DELETE FROM tournament_security.translations WHERE kind='note' AND source_id=OLD.id;
 ELSE
  IF TG_OP='UPDATE' AND OLD.tournament_id<>NEW.tournament_id THEN
   DELETE FROM tournament_security.translations WHERE kind='note' AND source_id=OLD.id;
  END IF;
  PERFORM tournament_security.queue_translation(NEW.tournament_id,'note',NEW.id,NEW.observacao);
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER translate_rules AFTER INSERT OR UPDATE OF regulamento ON public.tournaments FOR EACH ROW EXECUTE FUNCTION tournament_security.translation_source_changed();
CREATE TRIGGER translate_schedule_notes AFTER INSERT OR UPDATE OF observacao,tournament_id OR DELETE ON public.match_schedule FOR EACH ROW EXECUTE FUNCTION tournament_security.translation_source_changed();
REVOKE ALL ON FUNCTION tournament_security.queue_translation(uuid,text,uuid,text),tournament_security.translation_source_changed() FROM PUBLIC,anon,authenticated;
SELECT tournament_security.queue_translation(id,'rules',id,regulamento) FROM public.tournaments WHERE regulamento IS NOT NULL;
SELECT tournament_security.queue_translation(tournament_id,'note',id,observacao) FROM public.match_schedule WHERE observacao IS NOT NULL;

CREATE FUNCTION public.get_tournament_translations(tid uuid,lang text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',x.kind,'source_id',x.source_id,'source_text',x.source_text,
 'source_hash',x.source_hash,'text',CASE WHEN x.status='ready' THEN x.translated_text END,'status',x.status,'reviewed',x.reviewed)),'[]')
 FROM tournament_security.translations x
 WHERE x.tournament_id=tid AND x.language=lang AND (
 x.kind='rules' OR EXISTS(SELECT 1 FROM public.match_schedule s JOIN public.matchups m ON m.tournament_id=s.tournament_id
 AND m.published IS TRUE AND m.grupo=s.grupo AND ((m.player1_id=s.player1_id AND m.player2_id=s.player2_id) OR (m.player1_id=s.player2_id AND m.player2_id=s.player1_id))
 WHERE s.id=x.source_id AND s.tournament_id=tid));
$$;
REVOKE ALL ON FUNCTION public.get_tournament_translations(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tournament_translations(uuid,text) TO anon,authenticated;

CREATE FUNCTION public.get_translation_review(tid uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY kind,source_id,language) FROM tournament_security.translations x WHERE tournament_id=tid),'[]');
END $$;
CREATE FUNCTION public.save_translation_review(tid uuid,field text,sid uuid,lang text,expected_hash text,content text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 IF content IS NULL OR btrim(content)='' OR length(content)>200000 THEN RAISE EXCEPTION 'Informe uma tradução válida (até 200 mil caracteres).'; END IF;
 UPDATE tournament_security.translations SET translated_text=content,status='ready',reviewed=true,updated_at=now()
 WHERE tournament_id=tid AND kind=field AND source_id=sid AND language=lang AND source_hash=expected_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'O texto original mudou. Atualize a página antes de salvar a revisão.'; END IF;
END $$;
CREATE FUNCTION public.regenerate_translation(tid uuid,field text,sid uuid,lang text,expected_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT account_security.is_approved() OR NOT public.can_access_tournament(tid) THEN RAISE EXCEPTION 'Sem permissão' USING ERRCODE='42501'; END IF;
 UPDATE tournament_security.translations SET status='pending',reviewed=false,translated_text=NULL,attempts=0,next_attempt=now(),updated_at=now()
 WHERE tournament_id=tid AND kind=field AND source_id=sid AND language=lang AND source_hash=expected_hash AND updated_at<now()-interval '1 minute';
 IF NOT FOUND THEN RAISE EXCEPTION 'Atualize a página ou aguarde um minuto antes de gerar novamente.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.get_translation_review(uuid),public.save_translation_review(uuid,text,uuid,text,text,text),public.regenerate_translation(uuid,text,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_translation_review(uuid),public.save_translation_review(uuid,text,uuid,text,text,text),public.regenerate_translation(uuid,text,uuid,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
