import { Button } from "@/components/ui/button";
import { criterionLabels, defaultCriteria, type Criterion } from "@/lib/tiebreakers";

export default function TiebreakerEditor({ value, h2hFirst, onChange }: { value: Criterion[] | null; h2hFirst: boolean; onChange: (value: Criterion[] | null) => void }) {
  const criteria = value || defaultCriteria(h2hFirst);
  const move = (index: number, direction: number) => {
    const next = [...criteria];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  };
  return <section className="space-y-3 sm:col-span-2" aria-label="Ordem dos critérios de desempate">
    <h3 className="font-medium">Ordem dos critérios de desempate</h3>
    <p className="text-xs text-muted-foreground">Pontos de vitória são sempre o primeiro critério. Os seguintes são usados somente quando o anterior empatar. Pontos de mesa respeitam a opção de maior ou menor pontuação; penalidades favorecem quem tem menos ocorrências.</p>
    <ol className="space-y-2">
      {criteria.map((criterion, index) => <li key={criterion} className="flex flex-wrap items-center gap-2 rounded border p-2">
        <span className="flex-1 min-w-40">{index + 1}. {criterionLabels[criterion]}</span>
        <Button type="button" size="sm" variant="outline" disabled={index <= 1} aria-label={`Subir ${criterionLabels[criterion]}`} onClick={() => move(index, -1)}>Subir</Button>
        <Button type="button" size="sm" variant="outline" disabled={index === 0 || index === criteria.length - 1} aria-label={`Descer ${criterionLabels[criterion]}`} onClick={() => move(index, 1)}>Descer</Button>
        <Button type="button" size="sm" variant="ghost" disabled={index === 0} aria-label={`Remover ${criterionLabels[criterion]}`} onClick={() => onChange(criteria.filter(c => c !== criterion))}>Remover</Button>
      </li>)}
    </ol>
    {(Object.keys(criterionLabels) as Criterion[]).some(c => !criteria.includes(c)) && <fieldset className="space-y-2">
      <legend className="text-sm">Adicionar critério</legend>
      <div className="flex flex-wrap gap-2">{(Object.keys(criterionLabels) as Criterion[]).filter(c => !criteria.includes(c)).map(c => <Button key={c} type="button" size="sm" variant="outline" onClick={() => onChange([...criteria, c])}>Adicionar {criterionLabels[c]}</Button>)}</div>
    </fieldset>}
    <Button type="button" variant="outline" size="sm" onClick={() => onChange(["victory_points", "wins", "penalties", "table_points"])}>Usar pontos → vitórias → penalidades → mesa</Button>
    {value !== null && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>Restaurar ordem padrão</Button>}
    <p className="text-xs text-muted-foreground">Entre grupos diferentes, o confronto direto é ignorado. Desistentes e eliminados continuam atrás dos jogadores ativos. Alterar a ordem pode mudar os classificados de um torneio em andamento.</p>
    <p className="text-xs text-muted-foreground">Confronto direto compara as vitórias nos jogos entre dois participantes empatados. Se houver mais de dois empatados, ou nenhum vencedor entre eles, segue para o próximo critério. Uma ocorrência de penalidade corresponde a um resultado com penalidade registrada, sem pesos por tipo.</p>
    <p className="text-xs text-muted-foreground">Número de vitórias conta as partidas com pontos de vitória maiores que zero. Como cada vitória vale uma pontuação fixa no torneio, esse critério equivale aos pontos de vitória e não desfaz empates entre eles. Pontos de mesa não contam como vitória.</p>
  </section>;
}
