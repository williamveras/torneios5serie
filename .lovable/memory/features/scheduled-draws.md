---
name: Scheduled Draws
description: Agendamento automático do sorteio de confrontos via cron, com aviso público até o sorteio acontecer
type: feature
---

## Tabela `scheduled_draws`

- Colunas: `tournament_id`, `fase`, `mode` ('por_grupo' | 'geral'), `scheduled_at`, `status` ('pending'|'done'|'failed'|'cancelled'), `executed_at`, `error_message`, `created_by`.
- RLS: anon SELECT (para exibir aviso público), authenticated CRUD.

## Execução automática

- Função `public.execute_scheduled_draws()` (SECURITY DEFINER) processa todos os `pending` cujo `scheduled_at <= now()`.
- Sempre **substitui** os matchups existentes da `fase` (delete + insert).
- Modos:
  - `geral`: `array_agg(id ORDER BY random())`, forma pares sequenciais.
  - `por_grupo`: para cada grupo dos jogadores não eliminados, faz round-robin (circle method) gravando `rodada`.
- Agendada via `pg_cron` job `execute-scheduled-draws` rodando a cada minuto.

## UI Admin (MatchupsTab)

- Bloco "Agendar sorteio automático" com inputs `date` e `time`. Cria registro em `scheduled_draws` usando a fase/modo atualmente selecionados.
- Lista de "Sorteios agendados" mostra pendentes com botão de cancelar (status='cancelled').

## UI Pública (PublicDraw)

- Se a fase já tem matchups, mostra normalmente.
- Se não tem matchups mas há `scheduled_draws` pendente para a fase, mostra card "Sorteio agendado para DD de mês de AAAA às HH:MM".
- A aba "Sorteio dos confrontos - [fase]" aparece quando há matchups OU sorteio pendente.
