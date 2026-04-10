

## Nova Aba: Agenda de Partidas

### Resumo
Criar uma nova aba "Agenda" no torneio para registrar, visualizar, editar e apagar os dias e horários das partidas, organizados por grupo e data.

### 1. Migração do Banco de Dados

Nova tabela `match_schedule`:

```sql
CREATE TABLE public.match_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player1_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  player2_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  grupo text NOT NULL,
  data_partida date NOT NULL,
  horario time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_schedule ENABLE ROW LEVEL SECURITY;
-- Políticas: todos autenticados podem SELECT, INSERT, UPDATE, DELETE
```

### 2. Novo Componente `ScheduleTab.tsx`

**Formulário de cadastro:**
- Select de Grupo (A, B, C...)
- Select do Jogador 1 e Jogador 2 (exibindo nick)
- DatePicker para data da partida
- Input de horário (type="time")
- Botão Salvar

**Visualização:**
- Agrupado por Grupo (título "Grupo A", "Grupo B"...)
- Dentro de cada grupo, agrupado por data com título formatado: "Segunda (23/04)"
- Cada partida exibida como: "Nick1 e Nick2: 18:00"
- Ordenado por data e horário crescente
- Botões de editar (abre formulário preenchido) e apagar (com confirmação) em cada registro

### 3. Integrar no `TournamentPage.tsx`

- Adicionar nova aba "Agenda" entre "Registrar Resultados" e "Classificação"
- Importar e renderizar `ScheduleTab`

### Detalhes Técnicos
- Usar `date-fns` com locale `pt-BR` para formatar dias da semana
- Componente de calendário Shadcn para o DatePicker
- Dialog para edição inline
- AlertDialog para confirmação de exclusão

