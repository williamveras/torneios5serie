ALTER TABLE public.tournaments DROP CONSTRAINT valid_tie_breaker_order;
UPDATE public.tournaments t SET tie_breaker_order = ARRAY(
 SELECT CASE WHEN item='penalty_presence' THEN 'penalties' ELSE item END
 FROM unnest(coalesce(t.tie_breaker_order,CASE WHEN t.h2h_before_mesa
 THEN ARRAY['victory_points','head_to_head','table_points','penalties']
 ELSE ARRAY['victory_points','table_points','penalties','head_to_head'] END)) WITH ORDINALITY AS criteria(item,position)
 WHERE item<>'penalty_presence' OR NOT coalesce('penalties'=ANY(t.tie_breaker_order),false)
 ORDER BY position
) WHERE tie_breaker_order IS NULL OR 'penalty_presence'=ANY(tie_breaker_order);
ALTER TABLE public.tournaments ADD CONSTRAINT valid_tie_breaker_order CHECK (
 tie_breaker_order IS NULL OR (
 cardinality(tie_breaker_order) BETWEEN 1 AND 5 AND array_ndims(tie_breaker_order)=1
 AND array_lower(tie_breaker_order,1)=1 AND tie_breaker_order[1]='victory_points'
 AND array_position(tie_breaker_order,NULL) IS NULL
 AND tie_breaker_order <@ ARRAY['victory_points','wins','penalties','table_points','head_to_head']::text[]
 AND cardinality(array_positions(tie_breaker_order,'victory_points'))<=1
 AND cardinality(array_positions(tie_breaker_order,'wins'))<=1
 AND cardinality(array_positions(tie_breaker_order,'penalties'))<=1
 AND cardinality(array_positions(tie_breaker_order,'table_points'))<=1
 AND cardinality(array_positions(tie_breaker_order,'head_to_head'))<=1
 ));
NOTIFY pgrst,'reload schema';
