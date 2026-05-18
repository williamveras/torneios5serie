## Importação de confrontos por colagem de texto

Adiciona, na aba **Agenda** (área logada), um botão "Importar por texto" que abre um diálogo onde o usuário cola um bloco de texto bruto (ex.: o que é compartilhado no grupo) e o sistema extrai grupo, jogadores, data e horário, gravando em `matchups` e `match_schedule`.

### Arquivos

1. **`src/lib/matchupParser.ts`** (novo)
   - `parseMatchupsText(text, players)` percorre o texto linha a linha mantendo um "grupo atual".
   - Regras de detecção:
     - Cabeçalho de grupo: linha que casa com `/^grupo\s+(\d+)/i` → atualiza grupo corrente.
     - Confronto: linha contendo ` x ` (case-insensitive, com espaços ou separadores comuns) → captura nick à esquerda e à direita.
     - Linha imediatamente seguinte ao confronto:
       - Se contiver data (`DD/MM` ou `DD/MM/YYYY`) e hora (`HH:MM` ou `HH'h'MM`) → vira `data_partida` + `horario`.
       - Se contiver palavras-chave como `a definir`, `W.O`, `WO`, `bye` → vira `observacao` (sem data/hora).
   - Casamento de jogador: busca em `players` por `nick_playroom` (case-insensitive, trim); fallback `nome_completo`. Se não achar, marca a linha com erro.
   - Saída: array de `{ grupo, player1, player2, player1Id?, player2Id?, data?, horario?, observacao?, errors[] }`.

2. **`src/components/tournament/ImportMatchupsDialog.tsx`** (novo)
   - Campos: `Rodada` (number, obrigatório), `Texto` (textarea grande).
   - Botão "Pré-visualizar" → roda o parser e mostra tabela editável: Grupo | Jogador 1 | Jogador 2 | Data | Horário | Observação. Linhas com erro destacadas em vermelho com mensagem (ex.: "Jogador 'Fulano' não encontrado").
   - Botão "Confirmar e gravar":
     - Para cada linha válida: insere em `matchups` (tournament_id, rodada, grupo, player1_id, player2_id, fase atual). Pula se já existe par para a rodada.
     - Se há `data` + `horario`: insere também em `match_schedule`.
     - Se há `observacao` (W.O / a definir): só `matchups`, sem `match_schedule`.
   - Toast com resumo: X gravados, Y ignorados, Z com erro.

3. **`src/components/tournament/ScheduleTab.tsx`** (editado)
   - Adiciona botão "Importar por texto" no cabeçalho da aba ao lado do "Adicionar agendamento".
   - Após confirmar no diálogo, recarrega `fetchSchedules()` (e dispara reload da aba Confrontos via mecanismo já existente, se houver — caso contrário só recarrega o que essa aba controla; a aba Confrontos relê quando o usuário voltar para ela).

### Comportamento integrado

- A rodada informada faz Confrontos (logada) e a página pública mostrarem esses jogos como "rodada atual" e ocultarem a anterior (lógica já implementada em commits anteriores).
- Não duplica pares já existentes em `matchups` para a mesma rodada.
- Sem mudanças de schema.

### Exemplo de texto suportado

```text
Quarta rodada :

Grupo 1:
Nando_sousa x Zico10
Terça 12/05 20:45

Grupo 2:
felino x Cowboy
a definir
```

Resultado: 2 matchups gravados (rodada 4); 1 entrada em `match_schedule` (Nando vs Zico10 em 12/05 20:45); o jogo do Grupo 2 fica com observação "a definir" e sem agendamento.
