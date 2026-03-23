

## Adicionar Fases ao Sistema de Torneios

O torneio tem múltiplas fases (Fase de Grupos, 16 Avos, Oitavas, Quartas, Semifinal, Final). Cada fase tem suas próprias rodadas. Precisamos adicionar esse conceito ao banco de dados e atualizar o cadastro e a visualização.

### 1. Migração do Banco de Dados

Adicionar coluna `fase` (text, não nula, default `'Fase de Grupos'`) na tabela `match_results`.

### 2. Atualizar Registro de Resultados (`ResultsTab.tsx`)

- Adicionar um campo **Fase** (Select) com opções pré-definidas:
  - Fase de Grupos, 16 Avos, Oitavas de Final, Quartas de Final, Semifinal, Final
- Layout: Fase e Grupo na primeira linha, Rodada na segunda (ou grid de 3 colunas)
- O campo "Grupo" só aparece quando a fase é "Fase de Grupos" (nas fases eliminatórias não faz sentido filtrar por grupo)
- Salvar o valor da fase junto com cada resultado

### 3. Atualizar Visualização (`StandingsTab.tsx`)

- Adicionar filtro de **Fase** acima do filtro de grupo
- O filtro de grupo só aparece quando a fase selecionada é "Fase de Grupos"
- Na aba "Resultados por Rodada", agrupar e exibir a fase de cada resultado
- A classificação geral e exportação respeitam os filtros de fase + grupo

### Fases disponíveis (constante compartilhada)
```text
FASES = [
  "Fase de Grupos",
  "16 Avos",
  "Oitavas de Final", 
  "Quartas de Final",
  "Semifinal",
  "Final"
]
```

### Fluxo resumido
```text
Registro:  [Fase ▼] [Grupo] [Rodada]  →  Jogador 1 + Jogador 2  →  Salvar
Visualização:  [Fase ▼] [Grupo ▼ (se grupos)]  →  Classificação / Resultados por Rodada
```

