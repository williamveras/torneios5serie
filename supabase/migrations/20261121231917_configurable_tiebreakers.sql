ALTER TABLE public.tournaments ADD COLUMN tie_breaker_order text[];
ALTER TABLE public.tournaments ADD CONSTRAINT valid_tie_breaker_order CHECK (
 tie_breaker_order IS NULL OR (
 cardinality(tie_breaker_order) BETWEEN 1 AND 6 AND array_ndims(tie_breaker_order)=1
 AND array_lower(tie_breaker_order,1)=1 AND tie_breaker_order[1]='victory_points'
 AND array_position(tie_breaker_order,NULL) IS NULL
 AND tie_breaker_order <@ ARRAY['victory_points','wins','penalties','table_points','head_to_head','penalty_presence']::text[]
 AND cardinality(array_positions(tie_breaker_order,'victory_points'))<=1
 AND cardinality(array_positions(tie_breaker_order,'wins'))<=1
 AND cardinality(array_positions(tie_breaker_order,'penalties'))<=1
 AND cardinality(array_positions(tie_breaker_order,'table_points'))<=1
 AND cardinality(array_positions(tie_breaker_order,'head_to_head'))<=1
 AND cardinality(array_positions(tie_breaker_order,'penalty_presence'))<=1
 ));
-- A nullable configuration must not invalidate a tournament's preserved pool.
CREATE OR REPLACE FUNCTION tournament_security.group_signature(tid uuid) RETURNS text
LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT md5(jsonb_build_object(
 'results',(SELECT jsonb_agg(r ORDER BY r.id) FROM public.match_results r WHERE tournament_id=tid AND fase='Fase de Grupos'),
 'players',(SELECT jsonb_agg(jsonb_build_array(id,grupo,elimination_reason) ORDER BY id) FROM public.players WHERE tournament_id=tid),
 'settings',(SELECT (CASE WHEN t.tie_breaker_order IS NULL THEN to_jsonb(t)-'tie_breaker_order' ELSE to_jsonb(t) END)-'campeao_id'-'updated_at'-'nome'-'regulamento' FROM public.tournaments t WHERE id=tid))::text);
$$;
NOTIFY pgrst,'reload schema';
