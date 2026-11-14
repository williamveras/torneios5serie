# Identidade dos e-mails

Lembretes usam `organizations.email_from_name`, com fallback para `nome`.
Convites usam o nome da organização e seu domínio conhecido. Aprovações usam
`raw_user_meta_data.site_origin` para localizar a identidade de um dos três
domínios permitidos. Esse metadado serve apenas à apresentação do e-mail;
nunca concede aprovação, vínculo ou permissão. Cadastros antigos sem origem
mantêm a identidade geral.

O Auth da Tropa do Víni usa a mesma imagem, banco, usuários, JWT e SMTP do Auth
principal, com um processo separado para configurar o remetente por domínio.
Somente o Nginx de `torneios.vini10.com` encaminha `/api/auth/v1/` para ele.
A porta 19999 fica vinculada a 127.0.0.1. Não há novo banco.

Após publicar `public/auth-emails/recovery-vini.html`, execute na VPS central:

```
python3 ops/configure-vini-auth.py
```

Execute novamente ao atualizar imagem/configuração do Auth principal ou
credenciais SMTP/JWT. O Compose gerado em `/opt/torneios-vini-auth/compose.json`
contém segredos, tem permissão 0600 e não deve entrar no Git.
O contêiner tem reinício automático. Para voltar à rota anterior, restaure
`/opt/torneios-vini-auth/nginx.previous.conf` no virtual host do Víni, valide
com `nginx -t` e recarregue o Nginx.

Instale `approval_notifier.py` e `organization_invite_notifier.py` em
`/opt/torneios-supabase/`. Os timers existentes os carregam a cada execução.
Valide os modelos sem enviar mensagens com `python3 ops/test-email-branding.py`.
