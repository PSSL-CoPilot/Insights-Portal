"use client";

import { useEffect, useMemo, useState } from "react";
import { Target } from "lucide-react";
import { useApp } from "../AppContext";
import { ActionCard, type ActionStatus } from "./ActionCard";
import { RescueFlow } from "../drilldown/RescueFlow";
import { Badge, Card, SectionTitle } from "../ui/primitives";
import { buildActions } from "@/lib/data/narratives";
import { getSnapshot, kpiById, prevMonth, kpiDelta } from "@/lib/data/metrics";
import { formatCompactKpi } from "../kpi/KPICard";
import { fmtPp, fmtSignedPct, monthLabel, monthShort } from "@/lib/format";

const STORE = "bs.actions.v1";
const WATCH = ["post", "r-noaccess", "r-resched", "r-tech", "pending"] as const;

export function ActionsPage() {
  const { model, month, openKpi } = useApp();
  const actions = useMemo(() => buildActions(model, month), [model, month]);
  const [status, setStatus] = useState<Record<string, ActionStatus>>({});
  const pm = prevMonth(model, month);

  useEffect(() => {
    try {
      setStatus(JSON.parse(localStorage.getItem(STORE) ?? "{}"));
    } catch {}
  }, []);
  const set = (id: string, s: ActionStatus) =>
    setStatus((cur) => {
      const next = { ...cur, [id]: s };
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {}
      return next;
    });

  const rescue = actions.find((a) => a.id === "rescue");
  const snap = getSnapshot(model, month, null);

  return (
    <div className="space-y-10">
      <SectionTitle eyebrow={`Actions · ${monthLabel(month)}`} title="What should Brightspeed do next?" sub="Insights translated into owned, prioritised actions. Status changes are saved in this browser only (prototype)." />

      <div className="grid gap-5 xl:grid-cols-2">
        {actions.map((a, i) => (
          <ActionCard key={a.id} action={a} index={i} status={status[a.id] ?? "Open"} onStatus={(s) => set(a.id, s)} />
        ))}
      </div>

      <section id="rescue" className="scroll-mt-24">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="space-y-5">
            <div>
              <Badge tone="brand">RECOMMENDED WORKFLOW</Badge>
              <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight">Post-ODD Customer Rescue Workflow</h2>
              <p className="mt-2 max-w-xl text-[14.5px] leading-relaxed text-ink-2">
                Trigger at the first missed or rescheduled Original Due Date, use Pending Customer Contact as the risk signal, escalate from automated SMS to agent outreach, and close the loop on every outcome.
                {rescue && rescue.population !== null && <> The addressable population is <strong>{rescue.population.toLocaleString()}</strong> — {rescue.populationLabel.toLowerCase()}.</>}
              </p>
            </div>

            <Card className="p-5 sm:p-6">
              <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold"><Target className="size-4" /> Is the action working?</div>
              <p className="mb-4 text-xs text-mute">Track these after launch — the workflow is working when the highlighted measures fall from their {monthShort(month)} baseline.</p>
              <div className="space-y-2">
                {WATCH.map((id) => {
                  const def = kpiById(id)!;
                  const d = kpiDelta(model, def, month, null);
                  const v = snap[def.key] ?? null;
                  return (
                    <button key={id} onClick={() => openKpi(id)} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left transition hover:border-ink">
                      <span className="text-[13.5px] font-medium">{def.label}</span>
                      <span className="flex items-center gap-4">
                        <span className="num text-[15px] font-semibold">{formatCompactKpi(def, v)}</span>
                        <span className="num w-20 text-right text-xs font-bold text-bad">{d ? (d.kind === "pp" ? fmtPp(d.value) : fmtSignedPct(d.value)) : "—"}</span>
                        <span className="hidden text-[11px] text-soft sm:block">↓ target vs {pm ? monthShort(pm) : "prior"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
          <Card className="bg-[#fbfaf5] p-6"><RescueFlow /></Card>
        </div>
      </section>
    </div>
  );
}
