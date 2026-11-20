ALTER TABLE public.tournaments ADD COLUMN regulamento_resumo text;
ALTER TABLE tournament_security.translations DROP CONSTRAINT translations_kind_check;
ALTER TABLE tournament_security.translations ADD CONSTRAINT translations_kind_check
 CHECK (kind IN ('rules','rules_summary','note','result_note'));

CREATE OR REPLACE FUNCTION tournament_security.translation_source_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_TABLE_NAME='tournaments' THEN
  PERFORM tournament_security.queue_translation(NEW.id,'rules',NEW.id,NEW.regulamento);
  PERFORM tournament_security.queue_translation(NEW.id,'rules_summary',NEW.id,NEW.regulamento_resumo);
 ELSIF TG_TABLE_NAME='match_results' THEN
  IF TG_OP='DELETE' THEN
   DELETE FROM tournament_security.translations WHERE kind='result_note' AND source_id=OLD.id;
  ELSE
   IF TG_OP='UPDATE' AND OLD.tournament_id<>NEW.tournament_id THEN
    DELETE FROM tournament_security.translations WHERE kind='result_note' AND source_id=OLD.id;
   END IF;
   PERFORM tournament_security.queue_translation(NEW.tournament_id,'result_note',NEW.id,NEW.comentario);
  END IF;
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
DROP TRIGGER translate_rules ON public.tournaments;
CREATE TRIGGER translate_rules AFTER INSERT OR UPDATE OF regulamento,regulamento_resumo ON public.tournaments
 FOR EACH ROW EXECUTE FUNCTION tournament_security.translation_source_changed();
CREATE TRIGGER translate_result_notes AFTER INSERT OR UPDATE OF comentario,tournament_id OR DELETE ON public.match_results
 FOR EACH ROW EXECUTE FUNCTION tournament_security.translation_source_changed();

CREATE OR REPLACE FUNCTION public.get_tournament_translations(tid uuid,lang text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('kind',x.kind,'source_id',x.source_id,'source_text',x.source_text,
 'source_hash',x.source_hash,'text',CASE WHEN x.status='ready' THEN x.translated_text END,'status',x.status,'reviewed',x.reviewed)),'[]')
 FROM tournament_security.translations x
 WHERE x.tournament_id=tid AND x.language=lang AND (
 x.kind IN ('rules','rules_summary')
 OR (x.kind='result_note' AND EXISTS(SELECT 1 FROM public.match_results r
     WHERE r.id=x.source_id AND r.tournament_id=tid AND r.comentario=x.source_text))
 OR (x.kind='note' AND EXISTS(SELECT 1 FROM public.match_schedule s JOIN public.matchups m ON m.tournament_id=s.tournament_id
 AND m.published IS TRUE AND m.grupo=s.grupo AND ((m.player1_id=s.player1_id AND m.player2_id=s.player2_id) OR (m.player1_id=s.player2_id AND m.player2_id=s.player1_id))
 WHERE s.id=x.source_id AND s.tournament_id=tid)));
$$;

-- Keep all existing response fields and token-expiry checks for older frontends.
DROP FUNCTION public.validate_registration_token(text);
CREATE FUNCTION public.validate_registration_token(_token text)
RETURNS TABLE(tournament_id uuid,tournament_name text,expires_at timestamptz,modalidade text,regulamento text,whatsapp_group_url text,regulamento_resumo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT rl.tournament_id,t.nome,rl.expires_at,coalesce(t.modalidade,'individual'),t.regulamento,rl.whatsapp_group_url,t.regulamento_resumo
 FROM public.registration_links rl JOIN public.tournaments t ON t.id=rl.tournament_id
 WHERE rl.token=_token AND rl.expires_at>now() LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.validate_registration_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_registration_token(text) TO anon,authenticated;

DO $$ BEGIN
 PERFORM tournament_security.queue_translation(tournament_id,'result_note',id,comentario)
 FROM public.match_results WHERE nullif(btrim(comentario),'') IS NOT NULL;
END $$;
NOTIFY pgrst,'reload schema';
