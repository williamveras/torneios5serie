ALTER PUBLICATION supabase_realtime ADD TABLE public.phase_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matchups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_schedule;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;

ALTER TABLE public.phase_status REPLICA IDENTITY FULL;
ALTER TABLE public.match_results REPLICA IDENTITY FULL;
ALTER TABLE public.matchups REPLICA IDENTITY FULL;
ALTER TABLE public.match_schedule REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;