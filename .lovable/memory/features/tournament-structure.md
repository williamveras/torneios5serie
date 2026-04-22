---
name: Tournament Structure
description: Tournament phases and grouping logic
type: feature
---

## Fases (ordem oficial — fonte: src/lib/constants.ts)

1. Fase de Grupos
2. Segunda Fase
3. Terceira Fase
4. 16 Avos
5. Oitavas de Final
6. Quartas de Final
7. Semifinal
8. Final

"Segunda Fase" e "Terceira Fase" usam nomes genéricos porque servem para torneios de tamanhos variados (ex: 128→64→32 antes de 16 Avos). A partir de "16 Avos" os nomes seguem o padrão tradicional (futebol/esportes).

Em torneios menores, basta pular para a fase desejada — o sistema só lista no filtro de Classificação as fases que têm registros.

## Regra de classificação (regulamento padrão)

- Fase de Grupos: 5 primeiros de cada grupo classificam diretamente + os 18 melhores sextos colocados no geral avançam às eliminatórias.
- A partir daí é mata-mata.

## Lógica de grupos

- Coluna `players.grupo` (text, nullable) — só usada na "Fase de Grupos".
- Em fases eliminatórias, o campo `grupo` em `match_results` recebe o nome da fase (não há agrupamento por letra).
