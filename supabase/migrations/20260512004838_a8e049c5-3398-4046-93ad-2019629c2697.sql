UPDATE public.match_results
SET registered_by = '8033af04-6d85-49c4-9858-d16a332a4920'
WHERE rodada = 4
  AND grupo = '10'
  AND registered_by IS NULL;