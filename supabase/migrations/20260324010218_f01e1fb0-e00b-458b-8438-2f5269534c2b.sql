
-- Drop restrictive SELECT policies
DROP POLICY IF EXISTS "Users can view their own tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Users can view players of their tournaments" ON public.players;
DROP POLICY IF EXISTS "Users can view results of their tournaments" ON public.match_results;

-- Create open SELECT policies for all authenticated users
CREATE POLICY "Authenticated users can view all tournaments"
  ON public.tournaments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all players"
  ON public.players FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view all results"
  ON public.match_results FOR SELECT
  TO authenticated
  USING (true);

-- Also allow any authenticated user to insert players and results to any tournament
DROP POLICY IF EXISTS "Users can add players to their tournaments" ON public.players;
CREATE POLICY "Authenticated users can add players"
  ON public.players FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can add results to their tournaments" ON public.match_results;
CREATE POLICY "Authenticated users can add results"
  ON public.match_results FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update results of their tournaments" ON public.match_results;
CREATE POLICY "Authenticated users can update results"
  ON public.match_results FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can delete results from their tournaments" ON public.match_results;
CREATE POLICY "Authenticated users can delete results"
  ON public.match_results FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can update players of their tournaments" ON public.players;
CREATE POLICY "Authenticated users can update players"
  ON public.players FOR UPDATE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can delete players from their tournaments" ON public.players;
CREATE POLICY "Authenticated users can delete players"
  ON public.players FOR DELETE
  TO authenticated
  USING (true);
