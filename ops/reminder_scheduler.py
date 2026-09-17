#!/usr/bin/env python3
"""Send tournament reminders through Resend SMTP from the VPS.

Run with --dry-run to verify the selection without sending or writing data.
"""

import argparse
import html
import json
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


API = "http://127.0.0.1:18000/rest/v1"
DEFAULT_BASE = "https://torneios.5serie.net"
DEFAULT_ADDRESS = "comunicacoes@5serie.net"


def read_env():
    return dict(
        line.split("=", 1)
        for line in Path("/opt/torneios-supabase/.env").read_text().splitlines()
        if "=" in line and not line.startswith("#")
    )


def request(env, path, params=None, payload=None):
    url = API + path + ("?" + urlencode(params, safe="(),.*") if params else "")
    body = json.dumps(payload).encode() if payload is not None else None
    headers = {
        "apikey": env["SERVICE_ROLE_KEY"],
        "Authorization": "Bearer " + env["SERVICE_ROLE_KEY"],
        "Accept": "application/json",
    }
    if body is not None:
        headers["Content-Type"] = "application/json"
    with urlopen(Request(url, data=body, headers=headers, method="POST" if body is not None else "GET"), timeout=30) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def first(env, table, select, **filters):
    rows = request(env, "/" + table, {"select": select, "limit": 1, **{k: "eq." + str(v) for k, v in filters.items()}})
    return rows[0] if rows else None


def recipients(env, player_id):
    player = first(env, "players", "id,nome_completo,email,is_team", id=player_id)
    if not player:
        return []
    if not player["is_team"]:
        return [(player["id"], player["nome_completo"], player["email"])] if player["email"] else []
    members = request(env, "/team_members", {"select": "id,member_nome,member_email", "team_id": "eq." + player_id})
    return [(m["id"], m["member_nome"], m["member_email"]) for m in members if m["member_email"]]


def label(player):
    return (player or {}).get("nick_playroom") or (player or {}).get("nome_completo") or "Adversário"


def email_config(env, tournament):
    config = {"brand": "Torneios Quinta Série", "address": DEFAULT_ADDRESS, "base": DEFAULT_BASE}
    if tournament and tournament.get("organization_id"):
        org = first(env, "organizations", "nome,email_from_name,email_from_email,resend_secret_name,public_base_url", id=tournament["organization_id"])
        if org:
            config["brand"] = org["email_from_name"] or org["nome"] or config["brand"]
            config["address"] = org["email_from_email"] or config["address"]
            config["base"] = org["public_base_url"] or config["base"]
            # The current database uses the common Resend key. A per-organization
            # secret requires an explicitly configured environment variable.
            if org["resend_secret_name"]:
                config["key"] = env[org["resend_secret_name"]]
    return config


def build_html(name, opponent, tournament, when, url, brand):
    name, opponent, tournament, when, url, brand = map(html.escape, (name, opponent, tournament, when, url, brand))
    return f'''<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#111;padding:24px">
    <div style="max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:8px;padding:24px">
      <h2>Lembrete de partida</h2><p>Olá, <strong>{name}</strong>!</p>
      <p>Sua partida no torneio <strong>{tournament}</strong> começa em aproximadamente <strong>3 horas</strong>.</p>
      <p style="background:#f6f6f6;padding:12px;border-radius:6px"><strong>Adversário:</strong> {opponent}<br/>
      <strong>Horário:</strong> {when}</p>
      <p><a href="{url}" style="display:inline-block;background:#111;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Ver torneio</a></p>
      <p style="color:#666;font-size:12px;margin-top:24px">{brand}</p>
    </div></body></html>'''


def send(smtp, key, address, brand, recipient, subject, body):
    message = EmailMessage()
    message["From"] = f"{brand} <{address}>"
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content("Sua partida começa em aproximadamente 3 horas. Consulte o torneio para os detalhes.")
    message.add_alternative(body, subtype="html")
    if not smtp:
        smtp = smtplib.SMTP("smtp.resend.com", 587, timeout=30)
        smtp.starttls()
        smtp.login("resend", key)
    smtp.send_message(message)
    return smtp


def run(dry_run, minutes_before=180, window_minutes=10):
    env = read_env()
    key = env["RESEND_API_KEY"]
    matches = request(env, "/rpc/get_upcoming_matches_for_reminder", payload={"_minutes_before": minutes_before, "_window_minutes": window_minutes})
    smtp = None
    pending = sent = skipped = errors = 0
    try:
        for match in matches:
            try:
                sched = first(env, "match_schedule", "id,tournament_id,player1_id,player2_id,data_partida,horario,rodada", id=match["id"])
                if not sched:
                    continue
                p1, p2 = sched["player1_id"], sched["player2_id"]
                matchup_filter = {
                    "select": "published",
                    "tournament_id": "eq." + sched["tournament_id"],
                    "or": f"(and(player1_id.eq.{p1},player2_id.eq.{p2}),and(player1_id.eq.{p2},player2_id.eq.{p1}))",
                }
                if sched["rodada"] is not None:
                    matchup_filter["rodada"] = "eq." + str(sched["rodada"])
                matchups = request(env, "/matchups", matchup_filter)
                if not any(m["published"] for m in matchups):
                    skipped += 1
                    continue
                tournament = first(env, "tournaments", "id,nome,organization_id", id=sched["tournament_id"])
                players = [first(env, "players", "id,nome_completo,nick_playroom", id=sched[k]) for k in ("player1_id", "player2_id")]
                config = email_config(env, tournament)
                when = sched["data_partida"][-2:] + "/" + sched["data_partida"][5:7] + "/" + sched["data_partida"][:4] + " às " + sched["horario"][:5]
                for side, other in ((players[0], players[1]), (players[1], players[0])):
                    if not side:
                        continue
                    for player_id, name, address in recipients(env, side["id"]):
                        if first(env, "match_reminders_sent", "id", schedule_id=sched["id"], player_id=player_id):
                            skipped += 1
                            continue
                        pending += 1
                        if dry_run:
                            continue
                        body = build_html(name, label(other), (tournament or {}).get("nome") or "Torneio", when, config["base"].rstrip("/") + "/p/" + sched["tournament_id"], config["brand"])
                        smtp = send(smtp, config.get("key", key), config["address"], config["brand"], address, "Sua partida começa em 3h — " + ((tournament or {}).get("nome") or ""), body)
                        request(env, "/match_reminders_sent", payload={"schedule_id": sched["id"], "player_id": player_id})
                        sent += 1
            except Exception as exc:
                errors += 1
                print(f"schedule={match.get('id')} error={type(exc).__name__}: {exc}", file=sys.stderr)
    finally:
        if smtp:
            smtp.quit()
    print(f"dry_run={dry_run} matches={len(matches)} pending={pending} sent={sent} skipped={skipped} errors={errors}")
    return 1 if errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--minutes-before", type=int, default=180)
    parser.add_argument("--window-minutes", type=int, default=10)
    args = parser.parse_args()
    if not args.dry_run and (args.minutes_before != 180 or args.window_minutes != 10):
        parser.error("time overrides require --dry-run")
    sys.exit(run(args.dry_run, args.minutes_before, args.window_minutes))
