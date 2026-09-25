"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Crosshair } from "lucide-react";
import { useApp } from "../AppContext";
import { planRows, StateRanking, StateTable, type PlanKind } from "../charts/StateRanking";
import { Badge, Card, cn, RichText, SectionTitle, Tabs } from "../ui/primitives";
import { kpiById } from "@/lib/data/metrics";
import { diagnose } from "@/lib/data/narratives";
import { fmtInt, fmtPct, fmtPct0, fmtSignedPct, monthLabel, monthName, stateSlug } from "@/lib/format";

const METRICS = [
  { id: "cancels", label: "Cancellations" },
  { id: "cancelRate", label: "Cancel rate" },
  { id: "post", label: "Post ODD %" },
  { id: "cust", label: "Customer Miss %" },
  { id: "pending", label: "Pending contact %" },
] as const;

/** State and Channel Plan: states first, then channels, then where the two intersect. */
export function PlanOverview(_: { kind: PlanKind }) {
  const { model, month, setState } = useApp();
  const router = useRouter();
  const open = (k: PlanKind, name: string) => {
    if (k === "state") setState(name);
    router.push(`/${k === "state" ? "states" : "channels"}/${stateSlug(name)}?month=${month}`);
  };
  const order: PlanKind[] = ["state", "channel"];
  return (
    <div className="space-y-12">
      <SectionTitle
        eyebrow={`State and Channel Plan · ${monthLabel(month)}`}
        title="Where do we need a plan?"
        sub="States first, then sales channels, each ranked by cancellation growth. Select any card to open its plan."
      />
      {order.map((k) => <PlanSection key={k} kind={k} open={open} />)}
      <StateChannelMatrix onState={(s) => open("state", s)} onChannel={(c) => open("channel", c)} />
    </div>
  );
}

function PlanSection({ kind, open }: { kind: PlanKind; open: (k: PlanKind, name: string) => void }) {
  const { model, month, state: filterState, setState } = useApp();
  const [metric, setMetric] = useState<(typeof METRICS)[number]["id"]>("cancels");
  const { rows, focus } = planRows(model, month, kind);
  const sorted = [...rows].sort((a, b) => (b.cancelsMoM ?? -1) - (a.cancelsMoM ?? -1));
  const go = (name: string) => open(kind, name);
  const noun = kind === "state" ? "state" : "channel";
  const sel = kind === "state" ? filterState : null;

  return (
    <section className="space-y-5">
      <div>
        <div className="eyebrow mb-1">{kind === "state" ? "By state" : "By channel"}</div>
        <h3 className="text-[20px] font-semibold tracking-tight">All {noun}s, ranked by cancellation growth</h3>
      </div>

      <div className={cn("grid gap-4 sm:grid-cols-2", kind === "state" ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
        {sorted.map((r, i) => {
          const isHot = focus === r.name;
          const up = (r.cancelsMoM ?? 0) > 0.005, down = (r.cancelsMoM ?? 0) < -0.005;
          return (
            <Card key={r.name} interactive onClick={() => go(r.name)} className={cn("group animate-rise p-5", isHot && "border-bad/40 bg-bad-soft", sel === r.name && "ring-2 ring-brand")} style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 text-[17px] font-semibold">{r.name}{isHot && <Badge tone="bad">FOCUS</Badge>}</div>
                  <div className="mt-0.5 text-xs text-mute">{fmtInt(r.sales)} sales · {fmtInt(r.installs)} installs</div>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-subtle text-mute transition-colors group-hover:bg-panel group-hover:text-white"><ArrowUpRight className="size-4" /></span>
              </div>
              <div className="mt-5 flex items-end justify-between">
                <div>
                  <div className="num text-[34px] font-semibold leading-none">{fmtInt(r.cancels)}</div>
                  <div className="mt-1 text-xs text-mute">cancellations</div>
                </div>
                <div className={cn("num text-xl font-bold", up ? "text-bad" : down ? "text-good" : "text-mute")}>{fmtSignedPct(r.cancelsMoM)}</div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line-2 pt-3 text-center text-xs">
                <div><div className="num text-[15px] font-semibold">{fmtPct(r.cancelRate)}</div><div className="text-mute">cancel rate</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.postPct)}</div><div className="text-mute">Post ODD</div></div>
                <div><div className="num text-[15px] font-semibold">{fmtPct0(r.pendingPct)}</div><div className="text-mute">pending</div></div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-5">
        <Card className="p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[15px] font-semibold">Compare {noun}s</div>
            <Tabs tabs={METRICS.map((m) => ({ id: m.id, label: m.label }))} value={metric} onChange={setMetric} size="sm" />
          </div>
          <StateRanking model={model} month={month} def={kpiById(metric)!} selectedState={sel} onSelect={go} kind={kind} />
        </Card>
        <Card className="p-5 sm:p-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-semibold">{kind === "state" ? "State" : "Channel"} detail</div>
            {kind === "state" && filterState && <button onClick={() => setState(null)} className="text-xs font-semibold text-mute underline">Clear state filter</button>}
          </div>
          <StateTable model={model} month={month} selectedState={sel} onSelect={go} onDrill={go} kind={kind} />
        </Card>
      </div>
    </section>
  );
}

/** State × channel cancel rate heatmap for the drill month. */
export function StateChannelMatrix({ onState, onChannel, highlight }: { onState?: (s: string) => void; onChannel?: (c: string) => void; highlight?: string }) {
  const { model, month } = useApp();
  if (!model.stateChannel.length) return null;
  const rates = model.stateChannel.map((r) => r.cancelRate ?? 0);
  const lo = Math.min(...rates), hi = Math.max(...rates);
  const cell = (st: string, ch: string) => model.stateChannel.find((r) => r.state === st && r.channel === ch);
  const heat = (v: number) => {
    const t = hi > lo ? (v - lo) / (hi - lo) : 0;
    return t > 0.6 ? "bg-bad text-white" : t > 0.35 ? "bg-indigo text-[#111]" : t > 0.15 ? "bg-lilac text-[#111]" : "bg-subtle text-ink-2";
  };
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 text-[15px] font-semibold">State × Channel cancel rate · {model.drillMonth ? monthLabel(model.drillMonth) : ""}</div>
      <p className="mb-4 text-xs text-mute">Darker cells carry higher cancel rates. Select a row or column heading to open that plan.{month !== model.drillMonth ? " This cross view is published for the latest month only." : ""}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-separate border-spacing-1 text-[12.5px]">
          <thead>
            <tr>
              <th />
              {model.channelNames.map((c) => (
                <th key={c} className="px-1 pb-1 text-center font-semibold text-mute">
                  <button onClick={() => onChannel?.(c)} className={cn("hover:text-ink hover:underline", highlight === c && "text-ink")}>{c}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.states.map((s) => (
              <tr key={s}>
                <th className="whitespace-nowrap pr-2 text-left font-semibold">
                  <button onClick={() => onState?.(s)} className={cn("hover:underline", highlight === s && "text-ink")}>{s}</button>
                </th>
                {model.channelNames.map((c) => {
                  const r = cell(s, c);
                  return (
                    <td key={c} title={r ? `${s} ${c}: ${fmtInt(r.cancels)} cancellations of ${fmtInt(r.sales)} sales` : undefined}
                      className={cn("num rounded-lg px-2 py-2 text-center font-semibold", r?.cancelRate != null ? heat(r.cancelRate) : "bg-subtle text-soft", highlight && highlight !== s && highlight !== c && "opacity-45")}>
                      {fmtPct(r?.cancelRate ?? null)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
