
## Visão geral

Adicionar dois tipos de e-mails automáticos para os jogadores:

1. **Lembrete 2h antes** da partida agendada.
2. **Aviso de realocação** quando a data, horário ou observação de uma partida do jogador for alterada.

Os e-mails sairão pelo remetente padrão da Lovable (configuração de infraestrutura de e-mail acontece como passo prévio).

---

## 1. Campo de e-mail nos jogadores

- Adicionar coluna `email TEXT` (nullable) na tabela `players`.
- Atualizar:
  - **Formulário de cadastro/edição** em `PlayersTab` — novo input opcional "E-mail".
  - **Importação por CSV/XLSX** (`Player Import`) — mapear coluna "E-mail" se presente.
  - **Listagem** — mostrar discreto ícone/indicador para jogadores sem e-mail (pra você identificar quem ainda precisa preencher).

Jogadores sem e-mail simplesmente não recebem lembretes (sem erro).

---

## 2. Infraestrutura de e-mail (Lovable Cloud)

- Configurar domínio padrão da plataforma + provisionar fila de envio + tabelas de log.
- Criar template transacional React Email **`match-reminder`** (lembrete 2h antes) com:
  - Nome do torneio
  - Adversário (Nick no Playroom > Nome)
  - Grupo / fase
  - Data e horário
  - Observação (se houver)
- Criar template **`match-rescheduled`** (realocação) com:
  - Adversário
  - Dados anteriores (data/horário/observação)
  - Dados novos (data/horário/observação)
  - Quem realocou (nome do profile)

Edge function única `send-transactional-email` é usada por ambos.

---

## 3. Lembrete 2h antes — cron a cada 15 min

- Nova edge function **`send-match-reminders`** que:
  1. Busca em `match_schedule` partidas com `data_partida` + `horario` que caem na janela `[agora + 1h53min, agora + 2h07min]` (margem para cobrir o intervalo de 15 min do cron e evitar duplicatas).
  2. Para cada partida, busca e-mail e dados dos dois jogadores + torneio.
  3. Verifica em nova tabela **`match_reminders_sent`** (`schedule_id`, `player_id`, `sent_at`) se já foi enviado — pula se sim.
  4. Invoca `send-transactional-email` com `templateName: "match-reminder"`, `idempotencyKey: reminder-{schedule_id}-{player_id}`.
  5. Registra em `match_reminders_sent`.
- Agendamento via `pg_cron` a cada 15 minutos chamando essa edge function.

---

## 4. Aviso de realocação

- Modificar `ScheduleTab` (dialog "Realocar") para, **após `UPDATE` bem-sucedido em `match_schedule`**, comparar valores antigos vs novos. Se mudou `data_partida`, `horario` ou `observacao`:
  - Invocar `send-transactional-email` para os 2 jogadores (`templateName: "match-rescheduled"`).
  - `idempotencyKey: reschedule-{schedule_id}-{player_id}-{updated_at_timestamp}` para garantir que cada alteração dispara uma vez.
  - Passar `templateData` com valores anteriores, novos, nome de quem realocou (do `useAuth` + profile) e adversário.
- Se a partida realocada já tinha sido enviada para `match_reminders_sent`, removê-la dessa tabela para que o novo horário também receba seu lembrete de 2h antes.

---

## 5. Detalhes técnicos

**Tabelas novas / alteradas:**
- `players` → adiciona `email TEXT`
- `match_reminders_sent` → `id`, `schedule_id` (uuid), `player_id` (uuid), `sent_at` (timestamptz), unique(schedule_id, player_id). RLS: leitura/escrita só service role (manipulada pela edge function).

**Edge functions:**
- `send-transactional-email` (gerada pelo scaffold)
- `send-match-reminders` (cron, sem JWT, autenticada via header secret simples vindo do pg_cron)

**Templates (React Email .tsx):**
- `match-reminder.tsx`
- `match-rescheduled.tsx`

**Cron (`pg_cron`):**
```
*/15 * * * *  → POST send-match-reminders
```

**Validação:**
- Zod nos payloads das edge functions.
- Edge `send-match-reminders` checa que o request veio do cron (header com secret armazenado em Vault).

---

## 6. O que NÃO faz parte desse plano

- Não envia e-mail quando um confronto é apenas **criado/agendado pela primeira vez** (só lembrete 2h antes e quando há realocação).
- Não notifica admins logados.
- Não cria página/aba de "preferências de notificação" — basta ter o e-mail no cadastro.

---

## Próximos passos após sua aprovação

1. Executar migração: coluna `email` em `players` + tabela `match_reminders_sent`.
2. Configurar infraestrutura de e-mail Lovable (passo automático).
3. Criar templates e edge functions.
4. Agendar cron job.
5. Integrar disparo de realocação no `ScheduleTab`.
6. Atualizar formulário e import de jogadores para o novo campo de e-mail.
