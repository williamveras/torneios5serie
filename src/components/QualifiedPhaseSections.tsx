import type { ComponentProps } from "react";
import QualifiersView from "@/components/QualifiersView";

type Props = ComponentProps<typeof QualifiersView> & {
  nextFase: string;
  finalistIds?: Set<string>;
};

export default function QualifiedPhaseSections({ nextFase, finalistIds, qualifiers, ...props }: Props) {
  if (nextFase === "Final" && finalistIds) {
    const sections = [
      { title: "Classificados para a grande final", rows: qualifiers.direct.filter(row => finalistIds.has(row.playerId)) },
      { title: "Classificados para a disputa de terceiro", rows: qualifiers.direct.filter(row => !finalistIds.has(row.playerId)) },
    ];
    return <div className="space-y-6">{sections.map(({ title, rows }) => (
      <section key={title} className="space-y-4">
        <h2 className="text-xl font-bold">{title}</h2>
        <QualifiersView {...props} hideHeading qualifiers={{ ...qualifiers, direct: rows.map((row, i) => ({ ...row, position: i + 1 })), repescagem: [], playoff: [], notQualified: [] }} />
      </section>
    ))}</div>;
  }
  return <div className="space-y-4">
    <h2 className="text-xl font-bold">Classificados para a {nextFase === "Repescagem" ? "segunda fase e repescagem" : nextFase}</h2>
    <QualifiersView {...props} qualifiers={qualifiers} />
  </div>;
}
