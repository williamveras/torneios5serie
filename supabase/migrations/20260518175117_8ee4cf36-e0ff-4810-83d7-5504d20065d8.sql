UPDATE public.match_schedule s
SET rodada = m.rodada
FROM public.matchups m
WHERE s.rodada IS NULL
  AND m.rodada IS NOT NULL
  AND s.tournament_id = m.tournament_id
  AND (
    (s.player1_id = m.player1_id AND s.player2_id = m.player2_id)
    OR (s.player1_id = m.player2_id AND s.player2_id = m.player1_id)
  );