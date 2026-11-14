"""Vini mail identity on the shared Auth database. Run on the central VPS.

Re-run after updating the primary Auth image, JWT settings or SMTP credentials.
The generated Compose file contains secrets and stays outside Git, mode 0600.
"""
import json, subprocess, shutil
from pathlib import Path

def run(args,**kwargs):
    return subprocess.run(args,check=True,text=True,capture_output=True,**kwargs).stdout

root=Path('/opt/torneios-vini-auth');root.mkdir(mode=0o700,exist_ok=True)
info=json.loads(run(['docker','inspect','supabase-auth']))[0]
env=dict(pair.split('=',1) for pair in info['Config']['Env'])
env.update(GOTRUE_SITE_URL='https://torneios.vini10.com',
           API_EXTERNAL_URL=env['API_EXTERNAL_URL'].replace('torneios.5serie.net','torneios.vini10.com'),
           GOTRUE_SMTP_SENDER_NAME='Torneios Tropa do Víni',
           GOTRUE_MAILER_SUBJECTS_RECOVERY='Redefinir sua senha — Torneios Tropa do Víni',
           GOTRUE_MAILER_TEMPLATES_RECOVERY='https://torneios.vini10.com/auth-emails/recovery-vini.html')
network=next(iter(info['NetworkSettings']['Networks']))
config={'services':{'auth':{'image':info['Config']['Image'],'container_name':'torneios-vini-auth','restart':'unless-stopped',
        'environment':env,'ports':['127.0.0.1:19999:9999'],'networks':['backend'],
        'healthcheck':{'test':['CMD','wget','--no-verbose','--tries=1','--spider','http://localhost:9999/health'],'interval':'10s','timeout':'5s','retries':5}}},
        'networks':{'backend':{'external':True,'name':network}}}
path=root/'compose.json'
if path.exists():shutil.copy2(path,root/'compose.previous.json')
# Escape Compose interpolation so existing credentials are preserved verbatim.
path.write_text(json.dumps(config,ensure_ascii=False,indent=2).replace('$','$$'));path.chmod(0o600)
run(['docker','compose','-f',str(path),'up','-d','--wait','--wait-timeout','60'])
nginx=Path('/etc/nginx/sites-available/torneios-vini');text=nginx.read_text()
marker='    location ~ ^/api/(auth|rest|realtime|functions|storage)/v1(/|$) {'
if '127.0.0.1:19999' not in text:
    assert marker in text
    shutil.copy2(nginx,root/'nginx.previous.conf')
    text=text.replace(marker,'''    location ^~ /api/auth/v1/ {
        proxy_pass http://127.0.0.1:19999/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $remote_addr;
    }
'''+marker)
    nginx.write_text(text)
    try:run(['nginx','-t'])
    except Exception:shutil.copy2(root/'nginx.previous.conf',nginx);raise
    run(['systemctl','reload','nginx'])
print('Vini Auth mail identity configured; shared users, permissions and database preserved.')
