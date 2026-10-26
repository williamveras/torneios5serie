CREATE OR REPLACE FUNCTION public.get_scheduled_draws_public(_tournament_id uuid)
RETURNS TABLE(id uuid, fase text, scheduled_at timestamptz, status text, kind text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT d.id, d.fase, d.scheduled_at, d.status, d.kind
  FROM public.scheduled_draws d
  WHERE d.tournament_id = _tournament_id AND d.status IN ('pending', 'done')
  ORDER BY d.scheduled_at;
$$;
REVOKE ALL ON FUNCTION public.get_scheduled_draws_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_scheduled_draws_public(uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
