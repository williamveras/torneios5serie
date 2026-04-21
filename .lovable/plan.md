

## Adicionar "Segunda Fase" e "Terceira Fase" antes de 16 Avos

A partir de **16 Avos** mantemos a nomenclatura padrão (16 Avos, Oitavas, Quartas, Semifinal, Final). Para torneios maiores, como o do regulamento (128 → 64 → 32 antes de chegar em 16 Avos), adicionamos duas fases intermediárias com nomes genéricos.

### Nova ordem de fases

```text
Fase de Grupos
Segunda Fase        ← nova
Terceira Fase       ← nova
16 Avos
Oitavas de Final
Quartas de Final
Semifinal
Final
```

Mapeamento para o torneio do regulamento:

```text
Fase de Grupos  → 176 → classificam 128
Segunda Fase    → 128 → 64
Terceira Fase   →  64 → 32
16 Avos         →  32 → 16
Oitavas         →  16 → 8
Quartas         →   8 → 4
Semifinal       →   4 → 2
Final           →   2 → 1
```

Em torneios menores, basta pular para a fase desejada — o sistema só lista no filtro as fases que têm dados.

### O que muda

**1. `src/lib/constants.ts`**
Inserir `"Segunda Fase"` e `"Terceira Fase"` no array `FASES` entre `"Fase de Grupos"` e `"16 Avos"`. Como `FASES` é a única fonte da verdade, todos os componentes que a importam ganham as novas opções automaticamente:

- `ResultsTab` — select de "Fase" no formulário de registro de resultados.
- `StandingsTab` — select de "Fase" na Classificação (aba Classificação Geral e Resultados por Rodada). A lógica de `availableFases` já filtra por `FASES.filter(f => fases.includes(f))`, então a ordem correta no dropdown é preservada e as novas fases aparecem assim que houver registros.

**2. Verificação de propagação**
Confirmo que nenhum outro arquivo tem a lista de fases hard-coded (ex: `ScheduleTab`, exportação `.xlsx`). Se houver algum lugar usando string literal de fase, faço o ajuste para consumir `FASES`.

**3. Memória do projeto**
Atualizo `mem://features/tournament-structure` para refletir a nova ordem de 8 fases e a regra do regulamento (5 primeiros de cada grupo + 18 melhores sextos avançam, eliminatórias podem começar com qualquer quantidade de jogadores conforme o torneio).

### Não muda

- Schema do banco — coluna `fase` em `match_results` é `text` livre, aceita os novos rótulos sem migração.
- Dados existentes — nenhum rótulo é renomeado.
- Lógica de grupos — continua exclusiva de "Fase de Grupos".
- RLS, exportação `.xlsx`, fluxo de agendamento e participantes.

