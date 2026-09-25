"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { useApp } from "../AppContext";
import { StateRanking, StateTable } from "../charts/StateRanking";
import { Badge, Card, cn, SectionTitle, Tabs } from "../ui/primitives";
import { findHotspot, kpiById, stateRows } from "@/lib/data/metrics";
import { fmtInt, fmtPct, fmtPct0, fmtSignedPct, monthLabel, stateSlug } from "@/lib/format";

const METRICS = [
  { id: "cancels", label: "Cancellations" },
  { id: "cancelRate", label: "Cancel rate" },
  { id: "post", label: "Post-ODD %" },
  { id: "cust", label: "Customer Miss %" },
  { id: "pending", label: "Pending contact %" },
] as const;

export function StatesOverview() {
  const { model, month, state: filterState, setState } = useApp();
  const router = useRouter();
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("cancels");
  const rows = [...stateRows(model, month)].sort((a, b) => (b.cancelsMoM ?? -1) - (a.cancelsMoM ?? -1));
  const hot = findHotspot(model, month);
  const go = (s: string) => router.push(`/states/${stateSlug(s)}?month=${month}`);

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow={`States · ${monthLabel(month)}`} title="Which markets are contributing most?" sub="Ranked by cancellation growth. Open a state to walk through what changed, when, who, why and what to do." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((r, i) => {
          const isHot = hot?.state === r.state && (r.cancelsMoM ?? 0) > 0.15;
          return (
            <Card key={r.state} interactive onClick={() => go(r.state)} className={cn("animate-rise p-5", isHot && "border-bad/40 bg-[#fffafa]", filterState === r.state && "ring-2 ring-indigo/40")} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[17px] font-semibold">{r.state}{isHot && <Badge tone="bad">HOTSPOT</Badge>}</div>
                  <div className="mt-0.5 text-xs text-mute">{fmtInt(r.sales)} sales · {fmtInt(r.installs)} installs</div>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-[#f3f3ee] text-mute transition group-hover:bg-ink"><ArrowUpRight className="size-4" /></span>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="num text-[34px] font-semibold leading-none">{fmtInt(r.cancels)}</div>
                  <div className="mt-1 text-xs text-mute">cancellations</div>
                </div>
                <div className={cn("num text-xl font-bold", (r.cancelsMoM ?? 0) > 0.15 ? "text-bad" : "text-mute")}>{fmtSignedPct(r.cancelsMoM)}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-2 pt-3 text-center text-xs">
                <div><div className="num text-[15px] font-semibold">{fmtPct(r.cancelRate)}</div><div className="text-mute">cancel rate</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.postPct)}</div><div className="text-mute">post-ODD</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.pendingPct)}</div><div className="text-mute">pending</div></div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[15px] font-semibold">Compare states</div>
          <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} value={metric} onChange={setMetric} size="sm" />
        </div>
        <StateRanking model={model} month={month} def={kpiById(metric)!} selectedState={filterState} onSelect={go} />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[15px] font-semibold">State detail</div>
          {filterState && <button onClick={() => setState(null)} className="text-xs font-semibold text-mute underline">Clear state filter</button>}
        </div>
        <StateTable model={model} month={month} selectedState={filterState} onSelect={go} />
      </Card>
    </div>
  );
}
