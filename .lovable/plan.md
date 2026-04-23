

## Página pública para jogadores

Uma rota pública (sem login) onde participantes acompanham resultados, classificação e agenda do torneio em tempo real, com controle de "fase concluída" para evitar interpretações erradas de classificações parciais.

### Rota e acesso

- **URL pública**: `/p/:tournamentId` (ex: `https://torneios5serie.lovable.app/p/<id>`).
- Sem autenticação. Você compartilha o link com os jogadores.
- Botão **"Compartilhar link público"** no topo da `TournamentPage` (admin), copia a URL para a área de transferência.

### O que o jogador vê

Layout simples (header com nome do torneio + 3 abas), sem sidebar, mobile-first:

1. **Agenda** — lista de partidas agrupadas por data, mostrando horário, fase/grupo e os dois jogadores (nick com fallback para nome). Mesmo formato visual da `ScheduleTab` atual, mas só leitura.
2. **Resultados por Rodada** — agrupado por Fase → Rodada, mostrando jogador, pontos vitória, pontos mesa e penalidades. Idêntico à aba "Resultados por Rodada" da `StandingsTab`, somente leitura.
3. **Classificação** — tabela ordenada (mesma lógica de desempate já existente), com seletor de Fase e Grupo.

### Controle de "fase concluída" (parte central do pedido)

Você escolheu a opção mais simples: **mostrar sempre, com aviso quando estiver em andamento**. Para isso:

- **Nova tabela `phase_status`** (`tournament_id`, `fase`, `status` = `'em_andamento' | 'concluida'`, `updated_at`). Default = `em_andamento` quando há resultados sem marcação.
- **Novo controle no admin**, dentro da `StandingsTab`: ao lado do seletor de Fase, um botão toggle **"Marcar fase como concluída"** / **"Reabrir fase"**. Só visível para usuários autenticados.
- **Na página pública**:
  - Se `status = em_andamento`: banner amarelo bem visível no topo da Classificação e dos Resultados daquela fase com o texto:
    > ⚠️ **Fase em andamento** — esta classificação é parcial e pode mudar até o encerramento da fase.
  - Se `status = concluida`: banner verde discreto:
    > ✅ **Fase encerrada** — classificação oficial.

Assim você nunca precisa "esconder" dados (mais simples de operar), mas a comunicação é inequívoca.

### Detalhes técnicos

**Banco**
- Migração: criar tabela `phase_status` com unique `(tournament_id, fase)`, RLS:
  - SELECT: público (`USING (true)` para `anon` + `authenticated`) — necessário para a página pública ler.
  - INSERT/UPDATE/DELETE: só `authenticated`.
- Adicionar policies SELECT públicas (`anon`) em `players`, `match_results`, `match_schedule`, `tournaments` — hoje só `authenticated` enxerga. Isso é seguro: nenhuma dessas tabelas tem dado sensível (só nick, nome, horário público de jogo). WhatsApp e e-mail dos jogadores **não** serão expostos — a página pública seleciona só as colunas necessárias (`id`, `nome_completo`, `nick_playroom`, `grupo`).

> Observação de privacidade: a coluna `whatsapp` em `players` continua protegida porque o cliente público nunca a solicita, mas RLS não filtra por coluna. Para garantia extra, a página pública usa uma **view** `players_public` (`security_invoker=on`) expondo só id/nome/nick/grupo, e consulta sempre a view. Assim mesmo se alguém tentar `SELECT *` direto na tabela via API pública, continua sem acesso ao WhatsApp.

**Frontend**
- Nova rota em `App.tsx`: `<Route path="/p/:tournamentId" element={<PublicTournament />} />`.
- Novo arquivo `src/pages/PublicTournament.tsx` com 3 abas (Tabs do shadcn).
- Componentes auxiliares dentro da pasta `src/components/public/`:
  - `PublicSchedule.tsx`
  - `PublicResults.tsx`
  - `PublicStandings.tsx` (recebe `phaseStatus` e renderiza o banner)
- Reaproveita a lógica de cálculo de classificação extraída para um util `src/lib/standings.ts` (refator pequeno em `StandingsTab` para importar do mesmo lugar — evita duplicação).
- Botão "Compartilhar link público" em `TournamentPage.tsx` (header) usando `navigator.clipboard` + toast.
- Toggle "Marcar fase como concluída" em `StandingsTab.tsx` (lê/escreve `phase_status`).

**Sem alterações**
- Fluxo de admin (Participantes, Confrontos, Resultados, Agenda) permanece igual.
- Schema dos players/results/schedule não muda.
- RLS de escrita continua restrito a `authenticated`.

