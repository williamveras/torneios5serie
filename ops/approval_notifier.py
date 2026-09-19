#!/usr/bin/env python3
"""Deliver account approval notifications through Resend SMTP. No public endpoint."""
import argparse, fcntl, html, json, smtplib, ssl, subprocess, uuid
from email.message import EmailMessage
from pathlib import Path
ADMIN = 'williamveras2010@gmail.com'
BASE = 'https://torneios.5serie.net'
def sql(statement):
    result = subprocess.run(['docker','exec','-i','supabase-db','psql','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'],input=statement,text=True,capture_output=True,check=True)
    return result.stdout.strip()
def compose(row, sender):
    name=html.escape(row['name'] or 'usuário')
    email=html.escape(row['email'])
    decision=row['kind']
    msg=EmailMessage();msg['From']=sender;msg['To']=ADMIN if decision=='pending' else row['email']
    msg['Message-ID']=f"<{row['id']}@torneios.5serie.net>"
    if decision=='pending':
        url=BASE+'/account-approvals?request='+row['user_id']
        msg['Subject']='Nova conta aguardando aprovação — Torneios'
        plain=f"Um novo cadastro aguarda sua análise.\nNome: {row['name']}\nE-mail: {row['email']}\n\nAcesse {url} e entre com sua conta de administrador para aprovar ou recusar."
        body=f'<h2>Nova conta aguardando aprovação</h2><p>Nome: {name}<br>E-mail: {email}</p><p><a href="{url}">Analisar solicitação: aprovar ou recusar</a></p><p>Entre com sua conta de administrador. Abrir este link não aprova a conta automaticamente.</p>'
    elif decision=='approved':
        msg['Subject']='Sua conta foi aprovada — Torneios'
        plain=f"Olá, {row['name']}! Sua conta foi aprovada. Entre em {BASE}/auth com seu e-mail e senha. O acesso às organizações depende das permissões concedidas pela administração."
        body=f'<h2>Sua conta foi aprovada</h2><p>Olá, {name}! Seu cadastro foi aprovado.</p><p><a href="{BASE}/auth">Entrar no sistema</a></p><p>Use seu e-mail e senha. O acesso às organizações depende das permissões concedidas pela administração.</p>'
    else:
        msg['Subject']='Atualização sobre seu cadastro — Torneios'
        plain='Sua solicitação de cadastro não foi aprovada. Para esclarecer a decisão, entre em contato com a administração.'
        body=f'<h2>Cadastro não aprovado</h2><p>Olá, {name}.</p><p>{plain}</p>'
    msg.set_content(plain);msg.add_alternative('<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;line-height:1.6">'+body+'</body></html>',subtype='html')
    return msg
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    lock=open('/run/torneios-approvals.lock','w')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:return
    env={}
    for line in Path('/opt/torneios-supabase/.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            key,value=line.split('=',1);env[key]=value.strip().strip('"')
    raw=sql("""SELECT coalesce(json_agg(x),'[]') FROM (
      SELECT q.id,q.user_id,q.kind,q.attempts,u.email,left(coalesce(u.raw_user_meta_data->>'nome',''),200) AS name
      FROM account_security.mail_queue q JOIN auth.users u ON u.id=q.user_id
      JOIN account_security.requests r ON r.user_id=q.user_id
      WHERE q.sent_at IS NULL AND q.next_attempt<=now() AND q.attempts<10 AND u.email IS NOT NULL
      AND (q.kind<>'pending' OR r.status='pending') ORDER BY q.created_at LIMIT 25
    ) x;""")
    rows=json.loads(raw)
    if args.dry_run:print(f'Queued notifications ready: {len(rows)}');return
    for row in rows:
        identifier=str(uuid.UUID(row['id']))
        try:
            msg=compose(row,f"Torneios <{env['SMTP_ADMIN_EMAIL']}>")
            with smtplib.SMTP(env['SMTP_HOST'],int(env['SMTP_PORT']),timeout=30) as smtp:
                smtp.starttls(context=ssl.create_default_context());smtp.login(env['SMTP_USER'],env['SMTP_PASS']);smtp.send_message(msg)
            sql(f"UPDATE account_security.mail_queue SET sent_at=now(),attempts=attempts+1 WHERE id='{identifier}';")
            print('Notification delivered:',identifier,row['kind'])
        except Exception as error:
            sql(f"UPDATE account_security.mail_queue SET attempts=attempts+1,next_attempt=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)) WHERE id='{identifier}';")
            print('Notification failed; retry scheduled:',identifier,type(error).__name__)
if __name__=='__main__':main()
