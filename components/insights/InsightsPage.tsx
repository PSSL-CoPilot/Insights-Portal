"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useApp } from "../AppContext";
import { InsightCard } from "./InsightCard";
import { Card, cn, SectionTitle } from "../ui/primitives";
import { buildInsights, type Severity } from "@/lib/data/narratives";
import { monthLabel } from "@/lib/format";

const SEVS: { id: Severity | "all"; label: string }[] = [
  { id: "all", label: "All" }, { id: "critical", label: "Critical" }, { id: "high", label: "High" }, { id: "medium", label: "Medium" }, { id: "low", label: "Low" },
];

const DRILL_HREF: Record<string, string> = { "monthly overview": "/", "odd timing": "/cancellations?tab=timing", "september state drill": "/states", "watchtower signals": "/watchtower", "customer miss reasons": "/cancellations?tab=miss", "example journey": "/journey" };

export function InsightsPage() {
  const { model, month } = useApp();
  const [sev, setSev] = useState<Severity | "all">("all");
  const all = useMemo(() => buildInsights(model, month), [model, month]);
  const shown = sev === "all" ? all : all.filter((i) => i.severity === sev);
  const count = (s: Severity) => all.filter((i) => i.severity === s).length;

  return (
    <div className="space-y-9">
      <SectionTitle eyebrow={`Insights · ${monthLabel(month)}`} title="What does the data say?" sub="Generated from the workbook: each insight is a rule that fired on this month’s numbers, with its evidence and a recommended next step." />

      <div className="flex flex-wrap items-center gap-2.5">
        {SEVS.map((s) => (
          <button key={s.id} onClick={() => setSev(s.id)} className={cn("rounded-full border px-4 py-1.5 text-[13px] font-semibold transition", sev === s.id ? "border-ink bg-ink text-white" : "border-line bg-white text-mute hover:border-ink hover:text-ink")}>
            {s.label}
            <span className={cn("ml-2 text-xs", sev === s.id ? "text-brand" : "text-soft")}>{s.id === "all" ? all.length : count(s.id)}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <Card className="p-10 text-center text-sm text-mute">No insights at this severity for {monthLabel(month)}.</Card>
      ) : (
        <div className="space-y-4">
          {shown.map((i, k) => <InsightCard key={i.id} insight={i} index={k} />)}
        </div>
      )}

      {model.executiveQuestions.length > 0 && (
        <section>
          <SectionTitle eyebrow="From the workbook" title="The five executive questions" sub="Answers authored in the “Executive Questions” sheet — a reference frame for the generated insights above." className="mb-5" />
          <div className="grid gap-4 lg:grid-cols-2">
            {model.executiveQuestions.map((q) => {
              const href = DRILL_HREF[q.drill.toLowerCase().split("/")[0].trim()] ?? "/";
              return (
                <Card key={q.n} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-brand">{q.n}</span>
                    <div>
                      <h4 className="text-[15px] font-semibold leading-snug">{q.question}</h4>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{q.answer}</p>
                      {q.evidence && <p className="mt-2 text-xs text-mute"><strong className="text-ink-2">Evidence:</strong> {q.evidence}</p>}
                      {q.nextStep && <p className="mt-1 text-xs text-mute"><strong className="text-ink-2">Next:</strong> {q.nextStep}</p>}
                      {q.drill && <Link href={href} className="mt-3 inline-block text-xs font-semibold underline decoration-dotted">Primary drill: {q.drill} →</Link>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
