// Envia lembretes de partida por e-mail 3h antes do horário do jogo.
// Roda a cada 5 minutos via pg_cron. Idempotente: usa match_reminders_sent.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = "Torneios Quinta Série <comunicacoes@5serie.net>";
const PUBLIC_BASE = Deno.env.get("PUBLIC_APP_URL") ?? "https://torneios.5serie.net";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

interface Recipient {
  email: string;
  name: string;
  playerId: string; // id em match_reminders_sent (player ou team_member)
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`resend_${res.status}: ${body}`);
  }
}

function buildHtml(params: {
  playerName: string;
  opponentName: string;
  tournamentName: string;
  when: string;
  tournamentUrl: string;
}) {
  const { playerName, opponentName, tournamentName, when, tournamentUrl } = params;
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#111;padding:24px">
    <div style="max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:8px;padding:24px">
      <h2 style="margin:0 0 12px">Lembrete de partida</h2>
      <p>Olá, <strong>${playerName}</strong>!</p>
      <p>Sua partida no torneio <strong>${tournamentName}</strong> começa em aproximadamente <strong>3 horas</strong>.</p>
      <p style="background:#f6f6f6;padding:12px;border-radius:6px">
        <strong>Adversário:</strong> ${opponentName}<br/>
        <strong>Horário:</strong> ${when}
      </p>
      <p><a href="${tournamentUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ver torneio</a></p>
      <p style="color:#666;font-size:12px;margin-top:24px">Torneios Quinta Série</p>
    </div>
  </body></html>`;
}

async function getRecipients(playerId: string): Promise<Recipient[]> {
  const { data: p } = await supabase
    .from("players")
    .select("id, nome_completo, email, is_team")
    .eq("id", playerId)
    .maybeSingle();
  if (!p) return [];
  if (!p.is_team) {
    return p.email ? [{ email: p.email, name: p.nome_completo, playerId: p.id }] : [];
  }
  const { data: members } = await supabase
    .from("team_members")
    .select("id, member_nome, member_email")
    .eq("team_id", p.id);
  return (members ?? [])
    .filter((m: any) => !!m.member_email)
    .map((m: any) => ({ email: m.member_email, name: m.member_nome, playerId: m.id }));
}

function getPlayerLabel(p: any): string {
  if (!p) return "Adversário";
  return p.nick_playroom || p.nome_completo || "Adversário";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Janela: partidas cujo início (America/Sao_Paulo) esteja entre now+2h50m e now+3h10m.
  const { data: rows, error } = await supabase.rpc("get_upcoming_matches_for_reminder", {
    _minutes_before: 180,
    _window_minutes: 10,
  } as any);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: any[] = [];
  for (const row of (rows as any[]) ?? []) {
    try {
      const { data: sched } = await supabase
        .from("match_schedule")
        .select("id, tournament_id, player1_id, player2_id, data_partida, horario")
        .eq("id", row.id)
        .maybeSingle();
      if (!sched) continue;

      const { data: tournament } = await supabase
        .from("tournaments")
        .select("id, nome")
        .eq("id", sched.tournament_id)
        .maybeSingle();

      const { data: p1 } = await supabase
        .from("players")
        .select("id, nome_completo, nick_playroom")
        .eq("id", sched.player1_id)
        .maybeSingle();
      const { data: p2 } = await supabase
        .from("players")
        .select("id, nome_completo, nick_playroom")
        .eq("id", sched.player2_id)
        .maybeSingle();

      const tournamentUrl = `${PUBLIC_BASE}/p/${sched.tournament_id}`;
      const whenStr = `${sched.data_partida?.split("-").reverse().join("/")} às ${String(sched.horario).slice(0, 5)}`;

      for (const [side, other] of [[p1, p2], [p2, p1]] as const) {
        if (!side) continue;
        const recipients = await getRecipients(side.id);
        for (const r of recipients) {
          // dedupe: por schedule + player (id de player OU team_member)
          const { data: already } = await supabase
            .from("match_reminders_sent")
            .select("id")
            .eq("schedule_id", sched.id)
            .eq("player_id", r.playerId)
            .maybeSingle();
          if (already) continue;

          const html = buildHtml({
            playerName: r.name,
            opponentName: getPlayerLabel(other),
            tournamentName: tournament?.nome ?? "Torneio",
            when: whenStr,
            tournamentUrl,
          });
          await sendEmail(r.email, `Sua partida começa em 3h — ${tournament?.nome ?? ""}`, html);
          await supabase.from("match_reminders_sent").insert({
            schedule_id: sched.id,
            player_id: r.playerId,
          });
          results.push({ schedule_id: sched.id, to: r.email, ok: true });
        }
      }
    } catch (e: any) {
      results.push({ schedule_id: row.id, ok: false, error: String(e?.message ?? e) });
    }
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
