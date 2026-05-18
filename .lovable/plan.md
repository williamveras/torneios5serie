## Problemas

1. **Niks com espaço:** alguns jogadores foram cadastrados com espaços no nick (ex.: `borboleta lilás`), mas o texto colado da sala vem sem espaços (`borboletalilás`). A comparação atual usa `trim().toLowerCase()`, que não remove espaços internos, então não bate.

2. **Ambiguidade entre grupos:** o matching parcial (`includes`) faz `borboleta` casar com `borboleta lilás` (ou vice-versa), misturando jogadores de grupos diferentes (grupo 4 e grupo 9). Não há validação de que o jogador encontrado pertença ao grupo do bloco sendo importado.

## Solução

Ajustar os dois parsers — `src/lib/matchupParser.ts` e `src/lib/resultsParser.ts` — para:

### 1. Normalização sem espaços
- Trocar `norm(s)` por uma versão que remove **todos** os espaços internos além do trim/lowercase: `s.replace(/\s+/g, "").toLowerCase()`.
- Aplicar isso tanto ao nome digitado/colado quanto ao `nick_playroom` e `nome_completo` cadastrados.
- Resultado: `borboletalilás` (do texto) casa com `borboleta lilás` (cadastrado).

### 2. Matching restrito ao grupo (matchupParser)
- Em `parseMatchupsText`, `findPlayer` passa a receber o `currentGrupo` e a lista filtrada por aquele grupo. A busca por igualdade exata (nick → nome) acontece primeiro **dentro do grupo**; só se não houver nada no grupo é que tenta no conjunto global, e nesse caso adiciona um erro indicando “jogador encontrado em outro grupo”.
- O fallback `includes` (matching parcial) **só roda dentro do grupo** e exige correspondência única; se mais de um jogador do grupo bate parcialmente (ex.: `borboleta` vs `borboleta lilás` no mesmo grupo, se acontecer), retorna ambíguo com erro.

### 3. Matching restrito ao grupo (resultsParser)
- O resultsParser já infere o grupo a partir dos jogadores resolvidos, então a ambiguidade entre grupos é o problema central.
- Estratégia: tentar resolver os dois jogadores do bloco **em conjunto**, escolhendo a combinação onde ambos pertençam ao mesmo grupo. Se houver mais de uma combinação válida, marcar erro de ambiguidade; se a única combinação possível misturar grupos, marcar erro pedindo desambiguação.
- Manter prioridade: igualdade exata > `includes` apenas como fallback e apenas quando único.

### 4. Reforçar segurança do `includes`
- Hoje qualquer `includes` casa, mesmo strings muito curtas (ex.: `wo` casaria com vários nicks). Adicionar mínimo de 3 caracteres no termo buscado antes de permitir matching parcial, para reduzir falsos positivos.

## Arquivos afetados

- `src/lib/matchupParser.ts` — nova `norm`, `findPlayer` consciente de grupo, fallback parcial seguro.
- `src/lib/resultsParser.ts` — nova `norm`, resolução em conjunto dos 2 jogadores priorizando mesmo grupo, fallback parcial seguro.

Nenhuma mudança em UI ou no banco. As mensagens de erro existentes nas telas de pré-visualização (`ImportMatchupsDialog` e o equivalente de resultados) continuam exibindo os novos erros automaticamente.

## Observações

- A normalização sem espaços é aplicada **só para comparação**; os nomes originais continuam sendo exibidos na pré-visualização.
- Nenhum dado existente precisa ser corrigido — quem já estava cadastrado com espaço continua assim; o parser passa a tolerar a divergência.
