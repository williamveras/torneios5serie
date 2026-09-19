# Operação na VPS

O frontend é servido pelo Nginx em `torneios.5serie.net`. A API Supabase roda em Docker na própria VPS; o gateway só escuta em `127.0.0.1:18000` e o Nginx publica os caminhos `/api/auth/v1`, `/api/rest/v1`, `/api/realtime/v1`, `/api/storage/v1` e `/api/functions/v1`. O Studio e as portas PostgreSQL não são publicados na Internet.

O código do site usa `VITE_SUPABASE_URL=https://torneios.5serie.net/api` e a chave pública local `VITE_SUPABASE_PUBLISHABLE_KEY`. Esses valores são inseridos no build, pela `.env.production` privada no servidor. Nunca colocar a chave `SERVICE_ROLE_KEY` no frontend.

O PostgreSQL local contém as tabelas `public` e os usuários `auth` restaurados do backup. Sessões antigas não são transportadas; cada usuário precisa entrar de novo. O banco anterior do Lovable deve ter os jobs `execute-scheduled-draws` e `send-match-reminders-every-5min` desativados durante a troca.

Os sorteios automáticos usam `pg_cron` no banco local. Os lembretes usam `ops/reminder_scheduler.py` a cada cinco minutos via `torneios-reminders.timer`. O script consulta a API local com a chave de serviço guardada em `/opt/torneios-supabase/.env`, aplica a regra de partidas publicadas e envia pelo SMTP do Resend. Execute `python3 /opt/torneios-supabase/reminder_scheduler.py --dry-run` para verificar a seleção sem enviar mensagens. A chave SMTP continua sendo uma dependência externa enquanto os e-mails permanecerem no Resend.

Comandos úteis no servidor:

```sh
cd /opt/torneios-supabase && docker compose ps
systemctl status torneios-reminders.timer
journalctl -u torneios-reminders.service -n 50 --no-pager
docker exec supabase-db psql -U postgres -d postgres -c 'SELECT jobname, active FROM cron.job;'
```

O script `ops/backup.sh` gera um dump diário do banco em `/root/torneios-backups` e conserva 14 dias quando `torneios-backup.timer` está ativo. Guarde também uma cópia fora da VPS para recuperar dados caso a máquina inteira seja perdida.

Para publicar o mesmo frontend em outras organizações, mantenha `.env.production` com a URL da API e a chave pública locais e um `site-config.json` próprio fora do checkout. Após atualizar o código com `git pull --ff-only`, execute `sh ops/deploy-frontend.sh /etc/torneios/site-config.json`. O script instala dependências, compila em `dist-next`, copia a identidade da instalação para o build e guarda o `dist` anterior. A identidade no `public/site-config.json` do repositório não deve ser usada como configuração de outra VPS. O Nginx não precisa ser recarregado quando somente os arquivos do frontend mudam.

### E-mail de recuperação de senha

O template em português fica em `public/auth-emails/recovery.html`. Após publicar o frontend na VPS central, execute `python3 ops/configure-auth-emails.py` nessa VPS para configurar o assunto e o template no Auth e os caminhos `/api/auth/v1/verify`. O script preserva uma cópia protegida da configuração anterior, mantém o Resend e reinicia somente o serviço Auth. O Nginx também encaminha o antigo `/auth/v1/verify` para o caminho correto, para compatibilidade com links já enviados que ainda sejam válidos.


### Aprovação de novas contas

A migração `20260919114002_account_approvals.sql` deve ser aplicada uma única vez no banco central, com backup anterior. Contas existentes são preservadas como aprovadas. Novas contas entram pendentes por trigger em `auth.users`; 13 tabelas do sistema têm uma política RLS restritiva que exige aprovação. As permissões das organizações continuam sendo exigidas.

O responsável é a conta confirmada de `williamveras2010@gmail.com`, identificada pelo UUID na tabela privada `account_security.administrators`. Não use metadados editáveis do usuário para conceder essa permissão. A página `/account-approvals` exige login desse administrador, decisão explícita e confirmação. Decisões já concluídas não são alteradas pelo endpoint.

Instale `ops/approval_notifier.py` em `/opt/torneios-supabase/approval_notifier.py` e os arquivos `torneios-approvals.service` e `.timer` em `/etc/systemd/system/`. Execute `systemctl daemon-reload` e `systemctl enable --now torneios-approvals.timer`. O serviço usa Resend SMTP e a configuração protegida já existente; o timer verifica a fila a cada minuto. `--dry-run` só informa a quantidade de notificações prontas.

A fila tem até 10 tentativas por mensagem, com intervalo crescente até uma hora. Consulte `journalctl -u torneios-approvals.service` e `account_security.mail_queue` para falhas persistentes. Como em outras filas SMTP, uma queda após o envio e antes da confirmação no banco pode resultar em reenvio. O identificador da mensagem é estável.

Ao criar novas tabelas ou funções privilegiadas, mantenha a verificação de aprovação no banco. O cadastro público de participantes por links de inscrição continua independente das contas de administração.
