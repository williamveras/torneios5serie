"""Apply the VPS Auth mail paths and Portuguese recovery template.
Run on the central backend VPS after deploying the frontend template.
"""
from pathlib import Path
import datetime, shutil, subprocess
root = Path('/opt/torneios-supabase')
backup = Path('/root/torneios-migration-backup') / ('auth-mail-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(mode=0o700, parents=True)
for source in [root/'.env', root/'docker-compose.yml', Path('/etc/nginx/sites-available/torneios')]:
 shutil.copy2(source, backup/source.name)
 (backup/source.name).chmod(0o600)
env = root/'.env'
lines=env.read_text().splitlines()
for i,line in enumerate(lines):
 if line.startswith(('MAILER_URLPATHS_CONFIRMATION=', 'MAILER_URLPATHS_INVITE=', 'MAILER_URLPATHS_RECOVERY=', 'MAILER_URLPATHS_EMAIL_CHANGE=')):
  lines[i]=line.split('=',1)[0]+'="/api/auth/v1/verify"'
env.write_text('\n'.join(lines)+'\n');env.chmod(0o600)
compose=root/'docker-compose.yml';text=compose.read_text()
marker='      GOTRUE_MAILER_URLPATHS_RECOVERY: ${MAILER_URLPATHS_RECOVERY}'
assert marker in text
if 'GOTRUE_MAILER_TEMPLATES_RECOVERY:' not in text:
 text=text.replace(marker,marker+'\n      GOTRUE_MAILER_TEMPLATES_RECOVERY: https://torneios.5serie.net/auth-emails/recovery.html\n      GOTRUE_MAILER_SUBJECTS_RECOVERY: "Redefinir sua senha — Torneios"')
compose.write_text(text)
nginx=Path('/etc/nginx/sites-available/torneios');text=nginx.read_text()
# Compatibility for already-issued links that used the old root path.
if 'location = /auth/v1/verify' not in text:
 marker='    location /api/ {'
 assert marker in text
 text=text.replace(marker,'    location = /auth/v1/verify {\n        return 307 /api/auth/v1/verify$is_args$args;\n    }\n\n'+marker)
nginx.write_text(text)
subprocess.run(['nginx','-t'],check=True)
subprocess.run(['systemctl','reload','nginx'],check=True)
subprocess.run(['docker','compose','up','-d','--no-deps','auth'],cwd=root,check=True)
print('Auth email configuration applied. Protected backup:',backup)
