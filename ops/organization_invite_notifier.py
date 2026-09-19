#!/usr/bin/env python3
"""Deliver organization invitations through the existing Resend SMTP account."""
import argparse,fcntl,html,json,smtplib,ssl,uuid
from email.message import EmailMessage
from pathlib import Path
from approval_notifier import sql,BASE

def compose(row,sender):
    url=BASE+'/organization-invite?invite='+str(uuid.UUID(row['id']))
    name=html.escape(row['organization_name']);role='Administrador' if row['role']=='admin' else 'Membro'
    msg=EmailMessage();msg['From']=sender;msg['To']=row['email'];msg['Subject']='Convite para participar de uma organização — Torneios'
    msg['Message-ID']=f"<org-invite-{row['id']}@torneios.5serie.net>"
    msg.set_content(f"Você foi convidado para a organização {row['organization_name']}, como {role}.\n\nAceite em: {url}\n\nO convite vale por sete dias. Entre com o mesmo e-mail que recebeu esta mensagem. Se ainda não tem conta, cadastre-se e aguarde a aprovação antes de aceitar. Se não reconhece este convite, ignore a mensagem.")
    msg.add_alternative(f'<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;line-height:1.6"><h2>Convite para organização</h2><p>Você foi convidado para <strong>{name}</strong>, como <strong>{role}</strong>.</p><p><a href="{url}">Ver e aceitar convite</a></p><p>O convite vale por sete dias. Entre com o mesmo e-mail que recebeu esta mensagem. Se ainda não tem conta, cadastre-se e aguarde a aprovação antes de aceitar.</p><p>Se não reconhece este convite, ignore esta mensagem.</p></body></html>',subtype='html')
    return msg

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--dry-run',action='store_true');args=parser.parse_args()
    lock=open('/run/torneios-invites.lock','w')
    try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    except BlockingIOError:return
    env={}
    for line in Path('/opt/torneios-supabase/.env').read_text().splitlines():
        if '=' in line and not line.startswith('#'):
            k,v=line.split('=',1);env[k]=v.strip().strip('"')
    rows=json.loads(sql("""SELECT coalesce(json_agg(x),'[]') FROM (
      SELECT i.id,i.email,i.role,o.nome AS organization_name FROM account_security.organization_invites i JOIN public.organizations o ON o.id=i.organization_id
      JOIN account_security.requests r ON r.user_id=i.invited_by AND r.status='approved'
      WHERE i.status='pending' AND i.expires_at>now() AND i.sent_at IS NULL AND i.attempts<10 AND i.next_attempt<=now()
      AND public.has_org_role(i.organization_id,i.invited_by,ARRAY['owner','admin']::public.org_role[]) ORDER BY i.created_at LIMIT 25
    ) x;"""))
    if args.dry_run:print('Invitations ready:',len(rows));return
    for row in rows:
        identifier=str(uuid.UUID(row['id']))
        try:
            msg=compose(row,f"Torneios <{env['SMTP_ADMIN_EMAIL']}>")
            with smtplib.SMTP(env['SMTP_HOST'],int(env['SMTP_PORT']),timeout=30) as smtp:
                smtp.starttls(context=ssl.create_default_context());smtp.login(env['SMTP_USER'],env['SMTP_PASS']);smtp.send_message(msg)
            sql(f"UPDATE account_security.organization_invites SET sent_at=now(),attempts=attempts+1 WHERE id='{identifier}';")
            print('Invitation delivered:',identifier)
        except Exception as error:
            sql(f"UPDATE account_security.organization_invites SET attempts=attempts+1,next_attempt=now()+make_interval(secs=>least(3600,60*power(2,attempts)::integer)) WHERE id='{identifier}';")
            print('Invitation failed; retry scheduled:',identifier,type(error).__name__)
if __name__=='__main__':main()
