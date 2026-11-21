ALTER TABLE tournament_security.translations DROP CONSTRAINT translations_language_check;
ALTER TABLE tournament_security.translations ADD CONSTRAINT translations_language_check CHECK (language IN ('en','es','fr','it'));
CREATE OR REPLACE FUNCTION tournament_security.queue_translation(tid uuid,field text,sid uuid,source text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF source IS NULL OR btrim(source)='' THEN
  DELETE FROM tournament_security.translations WHERE tournament_id=tid AND kind=field AND source_id=sid;
  RETURN;
 END IF;
 INSERT INTO tournament_security.translations(tournament_id,kind,source_id,language,source_text,source_hash)
 SELECT tid,field,sid,lang,source,md5(source) FROM unnest(ARRAY['en','es','fr','it']) lang
 ON CONFLICT(tournament_id,kind,source_id,language) DO UPDATE SET source_text=EXCLUDED.source_text,
 source_hash=EXCLUDED.source_hash,translated_text=NULL,status='pending',reviewed=false,attempts=0,next_attempt=now(),updated_at=now()
 WHERE translations.source_hash<>EXCLUDED.source_hash;
END $$;
-- Queue existing content in Italian without changing any existing translation or review.
INSERT INTO tournament_security.translations(tournament_id,kind,source_id,language,source_text,source_hash)
 SELECT tournament_id,kind,source_id,'it',source_text,source_hash FROM tournament_security.translations WHERE language='en'
 ON CONFLICT DO NOTHING;
NOTIFY pgrst,'reload schema';
