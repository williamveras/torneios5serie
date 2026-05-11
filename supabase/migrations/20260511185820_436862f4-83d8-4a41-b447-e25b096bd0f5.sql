INSERT INTO matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
SELECT tournament_id, 'Fase de Grupos', grupo, player1_id, player2_id, 4
FROM match_schedule
WHERE created_at > now() - interval '3 hours';

INSERT INTO matchups (tournament_id, fase, grupo, player1_id, player2_id, rodada)
SELECT DISTINCT ON (a.created_at)
  a.tournament_id, 'Fase de Grupos', a.grupo, a.player_id, b.player_id, 4
FROM match_results a
JOIN match_results b
  ON a.tournament_id = b.tournament_id
  AND a.created_at = b.created_at
  AND a.player_id < b.player_id
  AND b.rodada = 4
WHERE a.rodada = 4
  AND NOT EXISTS (
    SELECT 1 FROM matchups m
    WHERE m.tournament_id = a.tournament_id
      AND m.rodada = 4
      AND ((m.player1_id = a.player_id AND m.player2_id = b.player_id)
        OR (m.player1_id = b.player_id AND m.player2_id = a.player_id))
  );