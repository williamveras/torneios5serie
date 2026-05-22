import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const { user_id, password } = await req.json();
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await admin.auth.admin.updateUserById(user_id, { password });
  return new Response(JSON.stringify({ data, error }), {
    headers: { "Content-Type": "application/json" },
    status: error ? 400 : 200,
  });
});
