## Filtrar agenda para mostrar apenas a rodada atual

Na aba "Agenda" (admin), na seção **"Partidas agendadas"**, exibir somente os confrontos da rodada atual. Rodadas anteriores ficam ocultas da visualização (mas continuam no banco e podem ser editadas via outras telas, sem perda de dados).

### Comportamento
- A rodada atual é o **maior número de rodada** existente em `matchups` do torneio (mesma lógica já usada em `PublicSchedule.tsx`).
- Apenas agendamentos com `rodada === rodadaAtual` são listados.
- Agendamentos sem rodada definida (`rodada == null`) também ficam ocultos, já que não pertencem à rodada atual. (Se preferir manter os "sem rodada" visíveis, me avise.)
- Se não houver nenhuma rodada em `matchups`, mostra mensagem "Nenhuma rodada atual definida."
- Se houver rodada atual mas nenhum agendamento nela, mostra "Nenhuma partida agendada para a rodada X."
- O formulário de agendamento e o botão "Importar por texto" continuam funcionando normalmente — somente a listagem é filtrada.

### Detalhes técnicos
Arquivo: `src/components/tournament/ScheduleTab.tsx`

1. Calcular `currentRound = Math.max(...matchups.map(m => m.rodada).filter(r => r != null))` (ou `null`).
2. Em `groupedSchedules()`, filtrar `schedules` por `s.rodada === currentRound` antes de agrupar.
3. Ajustar o título da seção para "Partidas agendadas — Rodada X" para deixar claro o escopo.
4. Ajustar as mensagens vazias conforme acima.

Nenhuma mudança em banco, parsers ou na página pública.