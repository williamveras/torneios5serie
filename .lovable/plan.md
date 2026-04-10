

## Distribuição Automática de Jogadores em Grupos

### Situação Atual
- A tabela `players` **não tem** coluna de grupo — os grupos são digitados manualmente ao registrar resultados e agendar partidas.
- Isso significa que não há vínculo direto entre jogador e grupo.

### Proposta

**1. Adicionar coluna `grupo` na tabela `players`** (text, nullable)

Migração SQL para adicionar o campo.

**2. Criar seção "Sortear Grupos" na aba Participantes (`PlayersTab.tsx`)**

- Aparece quando há jogadores cadastrados e ainda sem grupo definido
- Duas opções:
  - **Informar manualmente** quantos jogadores por grupo (ex: 4)
  - **Sugestão automática** — o sistema calcula a melhor divisão (ex: 32 jogadores → 8 grupos de 4; 18 jogadores → 3 grupos de 6)
- Botão "Sortear" distribui aleatoriamente os jogadores nos grupos (A, B, C...) e salva o `grupo` de cada um no banco
- Possibilidade de "Refazer Sorteio" caso necessário

**3. Exibir grupo na tabela de jogadores**

- Nova coluna "Grupo" na tabela de participantes
- Badge visual (ex: "Grupo A") ao lado de cada jogador

**4. Propagar o grupo automaticamente para as outras abas**

- **ResultsTab**: ao selecionar um jogador, o campo "Grupo" é preenchido automaticamente com base no grupo do jogador (sem digitação manual)
- **ScheduleTab**: ao selecionar jogadores, o grupo é preenchido automaticamente
- **StandingsTab**: sem mudanças — já filtra por grupo

**5. Algoritmo de sugestão automática**

Lógica simples:
- Divisores possíveis de 3 a 8 jogadores por grupo
- Escolhe o divisor que resulta na divisão mais equilibrada (menor resto)
- Se não houver divisão exata, distribui os jogadores extras um por grupo (ex: 17 jogadores com 4 por grupo → 3 grupos de 4 + 1 grupo de 5)

### Fluxo do Usuário
```text
Aba Participantes:
  [Jogadores por grupo: 4 ▼]  [Sugerir]  [Sortear Grupos]

  Tabela:
  | Grupo | Nome        | Nick    | WhatsApp | Horários |
  |  A    | Fulano      | nick1   | ...      | ...      |
  |  A    | Sicrano     | nick2   | ...      | ...      |
  |  B    | Beltrano    | nick3   | ...      | ...      |

Aba Resultados:
  [Jogador: Fulano ▼]  →  Grupo auto-preenchido: "A"
```

### Arquivos alterados
- `supabase/migrations/` — nova migração adicionando `grupo` à tabela `players`
- `src/components/tournament/PlayersTab.tsx` — UI de sorteio + coluna grupo
- `src/components/tournament/ResultsTab.tsx` — auto-preencher grupo ao selecionar jogador
- `src/components/tournament/ScheduleTab.tsx` — auto-preencher grupo ao selecionar jogadores
- `src/integrations/supabase/types.ts` — será atualizado automaticamente

