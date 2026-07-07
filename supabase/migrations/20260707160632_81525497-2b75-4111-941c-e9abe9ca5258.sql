
CREATE OR REPLACE FUNCTION public.get_upcoming_matches_for_reminder(
  _minutes_before int DEFAULT 180,
  _window_minutes int DEFAULT 10
)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ms.id
  FROM public.match_schedule ms
  WHERE ms.data_partida IS NOT NULL
    AND ms.horario IS NOT NULL
    AND ((ms.data_partida + ms.horario) AT TIME ZONE 'America/Sao_Paulo')
        BETWEEN (now() + make_interval(mins => _minutes_before - _window_minutes))
            AND (now() + make_interval(mins => _minutes_before + _window_minutes));
$$;

GRANT EXECUTE ON FUNCTION public.get_upcoming_matches_for_reminder(int, int) TO service_role;
