# Auditoria de inteligência do torneio

Analisei o fluxo atual (constantes de fases, geração de confrontos, classificação, qualifiers, status de fase, sorteios agendados e eliminações). Abaixo está o diagnóstico do que **já existe**, do que **falta**, e propostas concretas para cada fase.

---

## 1. O que o sistema JÁ entende sozinho

- **Fases pré-definidas** em ordem: Fase de Grupos → Segunda Fase → Terceira Fase → 16 Avos → Oitavas → Quartas → Semi → Final (`src/lib/constants.ts`).
- **Rodadas da Fase de Grupos**: calcula rodada atual e detecta quando a fase está completa (`computeCurrentRound`). Encerra a Fase de Grupos automaticamente quando todas as rodadas terminam.
- **Classificados da Fase de Grupos**: top-5 por grupo + 18 melhores 6º (`computeQualifiers`).
- **Mesa = posição do confronto** dentro da fase (`buildMesaMap`).
- **Sorteio agendado** via cron, substituindo confrontos da fase.
- **Eliminação manual por W.O.** (`players.eliminado`).

## 2. O que o sistema NÃO entende (lacunas de "inteligência")

1. **Não sabe quantos jogadores vão para a próxima fase.** Não há projeção do tamanho de cada fase (ex.: 128 → 64 → 32 → 16 → 8 → 4 → 2). Em mata-mata, ele não calcula automaticamente que "metade avança".
2. **Não elimina o perdedor automaticamente em mata-mata.** Hoje `eliminado` só é marcado em W.O. Quem perde a Segunda Fase continua "ativo" no banco, e o sorteio "geral" da próxima fase pegaria todos os não-eliminados (o que dá certo só porque, na prática, ninguém marca os perdedores).
3. **Não fecha automaticamente uma fase de mata-mata** quando todos os confrontos terminam (só a Fase de Grupos tem auto-fechamento).
4. **Não gera os confrontos da próxima fase a partir dos classificados.** O admin precisa abrir a aba, escolher a fase e clicar "Gerar". Não há "promover classificados → próxima fase".
5. **Não valida tamanho esperado vs. cadastrado.** Se classificaram 50 pessoas e o admin escolhe "16 Avos" (32 vagas), o sistema não avisa.
6. **Não nomeia a fase corretamente em torneios pequenos.** Se sobram 8 jogadores depois dos grupos, deveria ir direto para "Quartas de Final", pulando Segunda/Terceira Fase — hoje isso é manual.
7. **Não detecta o campeão.** Quando a Final termina, nada acontece automaticamente (sem badge, sem encerramento do torneio).
8. **Não há "chaveamento" (bracket).** Em mata-mata, o sistema sorteia confrontos aleatórios em cada fase, em vez de manter um chaveamento fixo onde "vencedor da Mesa 1 vs vencedor da Mesa 2", etc.

---

## 3. Sugestões propostas (por prioridade)

### A. Projeção automática de fases (núcleo da "inteligência")

Criar um helper `projectPhases(classifiedCount)` que devolve a sequência exata de fases que o torneio terá, com tamanhos. Exemplo: 128 classificados →
```text
Segunda Fase (128 → 64)
Terceira Fase (64 → 32)
16 Avos        (32 → 16)
Oitavas        (16 → 8)
Quartas        (8 → 4)
Semifinal      (4 → 2)
Final          (2 → 1)
```
- Se classificaram 32: pula direto para "16 Avos".
- Se classificaram 16: pula direto para "Oitavas".
- Aparece como **roadmap** na aba Classificação e na página pública ("Próximas fases").

### B. Eliminação automática do perdedor em mata-mata

Quando um resultado de fase eliminatória for registrado (os 2 jogadores postaram), marcar `players.eliminado = true` para o perdedor. Critério: maior `pontos_jogo` ganha; empate → maior `pontos_mesa`; empate total → admin decide (banner de "desempate pendente").

Benefício: o sorteio da próxima fase passa a usar **só os vencedores**, sem trabalho manual.

### C. Auto-encerrar fases eliminatórias

Mesma lógica que já existe para Fase de Grupos: quando todos os confrontos da fase têm resultado, marcar `phase_status = concluida` e disparar toast.

### D. "Promover classificados para a próxima fase" (1 clique)

Botão na aba Classificação, visível quando a fase atual está concluída:
- Calcula a próxima fase pelo projeto do item A.
- Cria os `matchups` da próxima fase com os vencedores/classificados.
- Modo: chaveamento fixo (bracket) **ou** sorteio aleatório, o admin escolhe.

### E. Chaveamento (bracket) opcional

Em torneios eliminatórios "puros", manter um bracket fixo é o padrão. Adicionar coluna `matchups.bracket_slot` para que a próxima fase saiba qual vencedor vai para qual mesa. Visualização em árvore na aba pública.

### F. Validações inteligentes ao gerar confrontos

- Se o admin tenta gerar "16 Avos" mas só há 20 jogadores não-eliminados, alertar: "16 Avos precisa de 32 jogadores; você tem 20. Quer ir direto para Oitavas (16) usando os 16 melhores?"
- Se o nº de jogadores não é potência de 2, oferecer "byes" automáticos para os melhores classificados.

### G. Detectar campeão e encerrar torneio

Quando a Final tiver resultado, marcar o vencedor (novo campo `tournaments.campeao_id`), exibir badge "🏆 Campeão" e card especial na página pública.

### H. Sugestões inteligentes contextuais (banners)

Na aba Classificação / página pública, mostrar avisos automáticos como:
- "Fase de Grupos concluída — clique para gerar os confrontos da Segunda Fase."
- "Próxima fase agendada para sorteio em DD/MM às HH:MM."
- "Faltam 3 confrontos para encerrar Oitavas."

---

## 4. Detalhes técnicos

- Novo arquivo `src/lib/phaseProjection.ts` com `projectPhases(n)` e `nextPhaseSize(currentSize)`.
- Trigger ou hook React em `ResultsTab` para marcar perdedor como `eliminado` ao salvar resultado eliminatório.
- Migration: `tournaments.campeao_id uuid references players(id) null`; opcional `matchups.bracket_slot int`.
- Reaproveitar `computeCurrentRound` para fases eliminatórias (1 rodada, N confrontos).
- Sem mudança em RLS/edge functions além de eventuais grants nas novas colunas.

---

## 5. Como gostaria de proceder?

Posso implementar isso em ondas. Sugestão de ordem:

1. **Onda 1 (núcleo lógico):** A (projeção) + C (auto-encerrar mata-mata) + H (banners) — só leitura/UI, baixo risco.
2. **Onda 2 (automação real):** B (eliminação automática) + D (promover classificados em 1 clique).
3. **Onda 3 (polimento):** E (bracket), F (validações), G (campeão).

Quer que eu siga com a Onda 1 já, ou prefere ajustar/priorizar diferente antes?
